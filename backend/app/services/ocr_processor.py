import io
import logging
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image, ImageSequence
import pytesseract
from app.config import TESSERACT_CMD
from app.core.exceptions import CorruptedFileException

logger = logging.getLogger(__name__)

# Configure pytesseract binary if detected
if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


class OCRProcessor:
    """
    Handles image preprocessing (grayscale, denoising, deskewing, adaptive thresholding)
    and text extraction via OCR with confidence calculation.
    """

    @classmethod
    def is_tesseract_available(cls) -> bool:
        """Check if Tesseract binary is callable."""
        try:
            _ = pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    @classmethod
    def preprocess_image(cls, image_np: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Applies OpenCV image preprocessing:
        1. Grayscale conversion
        2. Denoising
        3. Deskewing
        4. Adaptive thresholding / Binarization
        Returns: (preprocessed_binary_image, preprocessing_metadata)
        """
        h, w = image_np.shape[:2]
        meta: Dict[str, Any] = {
            "original_width": w,
            "original_height": h,
            "grayscale_applied": True,
            "denoising_applied": True,
            "deskew_angle": 0.0,
            "adaptive_threshold_applied": True,
        }

        # 1. Grayscale
        if len(image_np.shape) == 3 and image_np.shape[2] >= 3:
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        elif len(image_np.shape) == 3 and image_np.shape[2] == 1:
            gray = image_np[:, :, 0]
        else:
            gray = image_np.copy()

        # 2. Denoising (fast median blur or Gaussian for OCR clarity)
        denoised = cv2.GaussianBlur(gray, (3, 3), 0)

        # 3. Deskewing
        try:
            # Invert colors: text white, background black for contour/point detection
            thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) > 50:
                rect = cv2.minAreaRect(coords)
                angle = rect[-1]
                # Adjust OpenCV angle conventions
                if angle < -45:
                    angle = -(90 + angle)
                elif angle > 45:
                    angle = 90 - angle
                else:
                    angle = -angle

                # Only deskew if slight tilt detected (between 0.5 and 45 degrees)
                if 0.5 <= abs(angle) <= 45.0:
                    (cX, cY) = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D((cX, cY), angle, 1.0)
                    denoised = cv2.warpAffine(
                        denoised,
                        M,
                        (w, h),
                        flags=cv2.INTER_CUBIC,
                        borderMode=cv2.BORDER_REPLICATE,
                    )
                    meta["deskew_angle"] = round(float(angle), 2)
        except Exception as e:
            logger.warning("Deskew step skipped: %s", e)

        # 4. Adaptive Thresholding
        try:
            binary = cv2.adaptiveThreshold(
                denoised,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                11,
                2,
            )
        except Exception:
            _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

        return binary, meta

    @classmethod
    def extract_from_image_np(
        cls, image_np: np.ndarray, apply_preprocessing: bool = True
    ) -> Tuple[str, Optional[float], Dict[str, Any]]:
        """
        Takes a NumPy OpenCV image, optionally applies preprocessing,
        and runs OCR with confidence calculation.
        Returns: (extracted_text, ocr_confidence_score, preprocessing_metadata)
        """
        if apply_preprocessing:
            processed_img, meta = cls.preprocess_image(image_np)
        else:
            processed_img = image_np
            meta = {"preprocessing": "none"}

        # Check if tesseract is available
        if not cls.is_tesseract_available():
            msg = (
                f"[OCR Diagnostic: Image preprocessed successfully (Resolution: {image_np.shape[1]}x{image_np.shape[0]}, "
                f"Deskew Angle: {meta.get('deskew_angle', 0.0)}°). "
                "Tesseract OCR executable not detected in environment PATH. "
                "Image preprocessing completed.]"
            )
            return msg, None, meta

        try:
            # Extract OCR text and word-level confidence data
            data = pytesseract.image_to_data(processed_img, output_type=pytesseract.Output.DICT)
            words: List[str] = []
            confidences: List[int] = []

            for i in range(len(data["text"])):
                word = data["text"][i].strip()
                conf_val = data["conf"][i]

                try:
                    conf_int = int(float(conf_val))
                except (ValueError, TypeError):
                    conf_int = -1

                if word:
                    words.append(word)
                    if conf_int >= 0:
                        confidences.append(conf_int)

            extracted_text = " ".join(words)
            # If word reconstruction is sparse, fallback to image_to_string
            if not extracted_text:
                extracted_text = pytesseract.image_to_string(processed_img).strip()

            avg_conf = (
                round(float(np.mean(confidences)), 2)
                if confidences
                else (75.0 if extracted_text else 0.0)
            )

            return extracted_text, avg_conf, meta

        except pytesseract.TesseractNotFoundError:
            msg = (
                f"[Tesseract OCR binary not found. Image preprocessed ({image_np.shape[1]}x{image_np.shape[0]}).]"
            )
            return msg, None, meta
        except Exception as e:
            logger.error("OCR execution error: %s", e)
            return f"[OCR Error: {str(e)}]", 0.0, meta

    @classmethod
    def process_image_file(
        cls, file_bytes: bytes, filename: str
    ) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
        """
        Processes standalone images (.jpg, .png, .tiff multi-page).
        Returns: (pages_data, concatenated_text, file_metadata)
        """
        try:
            pil_image = Image.open(io.BytesIO(file_bytes))
        except Exception as e:
            raise CorruptedFileException(f"Failed to decode image file '{filename}': {str(e)}")

        pages: List[Dict[str, Any]] = []
        text_chunks: List[str] = []
        frame_idx = 1

        # Multi-page TIFF support using ImageSequence
        for frame in ImageSequence.Iterator(pil_image):
            # Convert PIL image to OpenCV format (RGB -> BGR)
            frame_rgb = frame.convert("RGB")
            frame_np = np.array(frame_rgb)
            frame_bgr = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)

            text, conf, meta = cls.extract_from_image_np(frame_bgr, apply_preprocessing=True)
            pages.append(
                {
                    "page_number": frame_idx,
                    "text": text,
                    "char_count": len(text),
                    "method": "ocr",
                    "ocr_confidence": conf,
                    "image_preprocessing": meta,
                }
            )
            text_chunks.append(text)
            frame_idx += 1

        total_text = "\n\n".join(text_chunks)
        metadata = {
            "page_count": len(pages),
            "image_format": pil_image.format,
            "dimensions": f"{pil_image.width}x{pil_image.height}",
        }

        return pages, total_text, metadata
