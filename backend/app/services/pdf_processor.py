import logging
from typing import Any, Dict, List, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Safe imports for headless / container environments
try:
    import pymupdf  # PyMuPDF
except (ImportError, Exception):
    try:
        import fitz as pymupdf
    except (ImportError, Exception):
        pymupdf = None
        logger.warning("pymupdf/fitz could not be imported.")

try:
    import cv2
except (ImportError, Exception):
    cv2 = None
    logger.warning("cv2 could not be imported in pdf_processor.")

from app.core.exceptions import (
    CorruptedFileException,
    DocumentProcessingException,
    PasswordProtectedException,
)
from app.services.ocr_processor import OCRProcessor


class PDFProcessor:
    """
    Intelligent PDF processor that streams pages (designed to scale up to 1000 pages),
    detects digital selectable text vs. scanned image pages, and triggers the OCR
    pipeline when appropriate.
    """

    MIN_DIGITAL_TEXT_CHARS = 25

    @classmethod
    def process_pdf(
        cls, file_bytes: bytes, filename: str
    ) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any], str]:
        """
        Processes a PDF file page by page.
        Returns:
            (pages_list, concatenated_text, metadata_dict, overall_extraction_method)
        """
        if pymupdf is None:
            raise CorruptedFileException(
                f"PyMuPDF library is not available to process '{filename}'.",
                error_code="PDF_PARSER_UNAVAILABLE"
            )

        try:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        except pymupdf.FileDataError as e:
            raise CorruptedFileException(f"Corrupted PDF header or data in '{filename}': {str(e)}")
        except Exception as e:
            raise CorruptedFileException(f"Failed to open PDF '{filename}': {str(e)}")

        # Check encryption / password
        if doc.is_encrypted or doc.needs_pass:
            doc.close()
            raise PasswordProtectedException(f"PDF '{filename}' is password protected and cannot be extracted.")

        total_pages = len(doc)
        if total_pages == 0:
            doc.close()
            raise CorruptedFileException(f"PDF '{filename}' contains 0 pages.", error_code="EMPTY_DOCUMENT")

        pages: List[Dict[str, Any]] = []
        text_chunks: List[str] = []
        digital_count = 0
        scanned_count = 0

        try:
            # Scale-friendly page-by-page streaming / chunking
            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_num = page_idx + 1

                # Step 1: Attempt digital text extraction
                raw_text = page.get_text("text").strip()
                alpha_count = sum(1 for c in raw_text if c.isalnum())

                # Step 2: Intelligent Digital vs Scanned Decision
                if alpha_count >= cls.MIN_DIGITAL_TEXT_CHARS:
                    # Page is digital with selectable text
                    method = "digital_pdf"
                    digital_count += 1
                    confidence = 100.0
                    page_text = raw_text
                    prep_meta = None
                else:
                    # Page is scanned (image-based) or contains negligible text
                    images = page.get_images(full=True)
                    method = "ocr"
                    scanned_count += 1

                    try:
                        # Render high-resolution pixmap (200 DPI) for OCR
                        pix = page.get_pixmap(dpi=200)
                        
                        # Convert PyMuPDF pixmap to OpenCV image format
                        img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                        if cv2 is not None:
                            if pix.n == 4:
                                img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
                            elif pix.n == 3:
                                img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
                            else:
                                img_bgr = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
                        else:
                            img_bgr = img_np

                        # Free pixmap memory immediately to prevent memory leak
                        del pix

                        # Process with image preprocessing & OCR pipeline
                        ocr_text, ocr_conf, prep_meta = OCRProcessor.extract_from_image_np(
                            img_bgr, apply_preprocessing=True
                        )
                        del img_bgr

                        # If digital text existed but was brief, preserve it alongside OCR output
                        if raw_text and ocr_text:
                            page_text = f"{raw_text}\n\n{ocr_text}"
                        else:
                            page_text = ocr_text or raw_text

                        confidence = ocr_conf

                    except Exception as ocr_err:
                        logger.warning("Failed to render/OCR page %d: %s", page_num, ocr_err)
                        page_text = raw_text or f"[OCR failed on page {page_num}: {str(ocr_err)}]"
                        confidence = 0.0
                        prep_meta = {"error": str(ocr_err)}

                pages.append(
                    {
                        "page_number": page_num,
                        "text": page_text,
                        "char_count": len(page_text),
                        "method": method,
                        "ocr_confidence": confidence,
                        "image_preprocessing": prep_meta,
                    }
                )
                if page_text:
                    text_chunks.append(f"--- Page {page_num} ---\n{page_text}")

            # Overall extraction method classification
            if scanned_count == 0:
                overall_method = "digital_pdf"
            elif digital_count == 0:
                overall_method = "ocr"
            else:
                overall_method = "hybrid_pdf"

            full_text = "\n\n".join(text_chunks)
            meta = {
                "page_count": total_pages,
                "digital_pages": digital_count,
                "scanned_pages": scanned_count,
                "pdf_version": doc.metadata.get("format", "PDF"),
                "author": doc.metadata.get("author", ""),
                "title": doc.metadata.get("title", ""),
            }

            return pages, full_text, meta, overall_method

        finally:
            doc.close()
