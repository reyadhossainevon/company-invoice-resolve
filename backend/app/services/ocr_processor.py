import io
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Safe imports for headless / container environments
try:
    import cv2
except (ImportError, Exception) as _cv2_err:
    cv2 = None
    logger.warning("cv2 (OpenCV) could not be imported: %s", _cv2_err)

import numpy as np
from PIL import Image, ImageSequence

try:
    import pytesseract
except (ImportError, Exception) as _tess_err:
    pytesseract = None
    logger.warning("pytesseract could not be imported: %s", _tess_err)

from app.config import TESSERACT_CMD
from app.core.exceptions import CorruptedFileException

# Configure pytesseract binary if detected
if pytesseract is not None and TESSERACT_CMD:
    try:
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    except Exception:
        pass


class OCRProcessor:
    """
    Handles image preprocessing (grayscale, denoising, deskewing, adaptive thresholding)
    and text extraction via OCR with confidence calculation.
    Supports Tesseract OCR with automatic fallback to RapidOCR (pure ONNX, zero external .exe dependencies).
    """

    _rapidocr_engine: Any = None

    @classmethod
    def get_rapidocr_engine(cls) -> Any:
        """Lazy load RapidOCR engine singleton."""
        if cls._rapidocr_engine is None:
            try:
                from rapidocr_onnxruntime import RapidOCR
                cls._rapidocr_engine = RapidOCR()
                logger.info("RapidOCR ONNX engine initialized successfully.")
            except Exception as e:
                logger.warning("RapidOCR could not be loaded: %s", e)
                cls._rapidocr_engine = False
        return cls._rapidocr_engine if cls._rapidocr_engine is not False else None

    @classmethod
    def is_tesseract_available(cls) -> bool:
        """Check if Tesseract binary is callable."""
        if pytesseract is None:
            return False
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

        # Fallback if cv2 is unavailable
        if cv2 is None:
            meta["preprocessing"] = "skipped_opencv_missing"
            return image_np, meta

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
        Tries Tesseract OCR first, and gracefully falls back to RapidOCR (pure ONNX)
        when Tesseract is not installed or available on Windows.
        Returns: (extracted_text, ocr_confidence_score, preprocessing_metadata)
        """
        if apply_preprocessing:
            processed_img, meta = cls.preprocess_image(image_np)
        else:
            processed_img = image_np
            meta = {"preprocessing": "none"}

        # 1. Try Tesseract OCR if binary is available
        if cls.is_tesseract_available():
            try:
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
                if not extracted_text:
                    extracted_text = pytesseract.image_to_string(processed_img).strip()

                if extracted_text and len(extracted_text.strip()) > 5:
                    avg_conf = (
                        round(float(np.mean(confidences)), 2)
                        if confidences
                        else (75.0 if extracted_text else 0.0)
                    )
                    meta["ocr_engine"] = "tesseract"
                    return extracted_text, avg_conf, meta
            except Exception as e:
                logger.warning("Tesseract attempt failed, trying RapidOCR fallback: %s", e)

        # 2. RapidOCR ONNX fallback (Pure Python/C++ ONNX runtime, zero Windows .exe dependency)
        rapid_engine = cls.get_rapidocr_engine()
        if rapid_engine is not None:
            try:
                # RapidOCR operates directly on the BGR image
                res, elapse = rapid_engine(image_np)
                # If nothing detected on raw, test against adaptive threshold image
                if not res and processed_img is not None and processed_img is not image_np:
                    res, elapse = rapid_engine(processed_img)

                if res:
                    lines: List[str] = []
                    scores: List[float] = []
                    for item in res:
                        # item format: [box_coordinates, text_str, confidence_float]
                        if len(item) >= 3:
                            t = str(item[1]).strip()
                            s = float(item[2])
                            if t:
                                lines.append(t)
                                scores.append(s * 100.0)
                        elif len(item) == 2:
                            t = str(item[1]).strip()
                            if t:
                                lines.append(t)
                                scores.append(85.0)

                    extracted_text = "\n".join(lines)
                    avg_conf = (
                        round(float(np.mean(scores)), 2)
                        if scores
                        else (85.0 if extracted_text else 0.0)
                    )
                    meta["ocr_engine"] = "rapidocr_onnxruntime"
                    meta["detected_lines"] = len(lines)
                    return extracted_text, avg_conf, meta
            except Exception as e:
                logger.error("RapidOCR extraction failed: %s", e)

        # 3. Fallback when neither engine detected text
        msg = (
            f"[OCR: Image processed ({image_np.shape[1]}x{image_np.shape[0]}, "
            f"Deskew Angle: {meta.get('deskew_angle', 0.0)}°). "
            "No readable text detected by OCR engine.]"
        )
        return msg, 0.0, meta

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
            if cv2 is not None:
                frame_bgr = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)
            else:
                frame_bgr = frame_np

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
