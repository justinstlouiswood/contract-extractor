"""
PDF Processor Module

This module handles extracting text from PDF files.
It uses two approaches:
1. PyPDF2 - For PDFs with embedded text (most digital documents)
2. OCR (Tesseract) - For scanned documents where text is in images

LEARNING NOTES:
- PyPDF2 reads PDFs that have "real" text in them (like Word docs saved as PDF)
- OCR (Optical Character Recognition) "reads" images of text, like a scanner
- We try PyPDF2 first because it's faster and more accurate
- If that doesn't work well, we fall back to OCR
"""

import logging
import time
import PyPDF2
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import io

logger = logging.getLogger('contract-extractor.pdf')

# Maximum pages to OCR (prevents OOM/hang on large scanned docs)
_OCR_MAX_PAGES = 20


def extract_text_with_pypdf2(pdf_path):
    """
    Extract text from PDF using PyPDF2.

    This works well for:
    - Documents created digitally (Word, Google Docs exported to PDF)
    - PDFs with selectable text

    Returns the extracted text as a string.
    """
    text = ""

    try:
        with open(pdf_path, 'rb') as file:
            # Create a PDF reader object
            reader = PyPDF2.PdfReader(file)

            # Loop through each page and extract text
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += f"\n--- Page {page_num + 1} ---\n"
                    text += page_text

    except Exception as e:
        logger.error("PyPDF2 extraction error: %s", e, exc_info=True)

    return text


def extract_text_with_ocr(pdf_path, max_pages=_OCR_MAX_PAGES):
    """
    Extract text from PDF using OCR (Optical Character Recognition).

    This works for:
    - Scanned documents
    - PDFs where text is actually an image
    - Documents with handwriting or unusual fonts

    Note: OCR is slower but can read "image" text that PyPDF2 can't see.
    Limited to max_pages to prevent OOM on large scanned documents.
    """
    text = ""

    try:
        # Convert PDF pages to images
        # DPI of 200 is a good balance between quality and speed
        images = convert_from_path(pdf_path, dpi=200, last_page=max_pages)

        if len(images) >= max_pages:
            logger.warning("OCR limited to first %d pages", max_pages)

        # Run OCR on each page image
        for page_num, image in enumerate(images):
            page_text = pytesseract.image_to_string(image)
            if page_text:
                text += f"\n--- Page {page_num + 1} (OCR) ---\n"
                text += page_text

    except Exception as e:
        logger.error("OCR extraction error: %s", e, exc_info=True)

    return text


def extract_text_from_pdf(pdf_path):
    """
    Main function to extract text from a PDF.

    Strategy:
    1. First try PyPDF2 (faster, more accurate for digital PDFs)
    2. If we get very little text, fall back to OCR
    3. Combine results if needed

    Returns the extracted text as a string.
    """

    # First, try the fast method (PyPDF2)
    start = time.time()
    pypdf_text = extract_text_with_pypdf2(pdf_path)
    pypdf_elapsed = time.time() - start
    logger.info("PyPDF2 extraction: %d chars in %.1fs", len(pypdf_text.strip()), pypdf_elapsed)

    # Check if we got meaningful text
    # If less than 500 characters, the PDF might be scanned/image-based
    if len(pypdf_text.strip()) < 500:
        logger.info("PyPDF2 found little text (%d chars), trying OCR...", len(pypdf_text.strip()))

        # Try OCR as fallback
        ocr_start = time.time()
        ocr_text = extract_text_with_ocr(pdf_path)
        ocr_elapsed = time.time() - ocr_start
        logger.info("OCR extraction: %d chars in %.1fs", len(ocr_text.strip()), ocr_elapsed)

        # Use whichever method gave us more text
        if len(ocr_text) > len(pypdf_text):
            return ocr_text

    return pypdf_text


def get_pdf_info(pdf_path):
    """
    Get basic information about a PDF file.

    Returns a dictionary with:
    - Number of pages
    - File size info
    - Whether it appears to be scanned
    """
    info = {
        'pages': 0,
        'has_text': False,
        'likely_scanned': False
    }

    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            info['pages'] = len(reader.pages)

            # Check first few pages for text
            text_sample = ""
            for page in reader.pages[:3]:
                text_sample += page.extract_text() or ""

            info['has_text'] = len(text_sample.strip()) > 100
            info['likely_scanned'] = not info['has_text']

    except Exception as e:
        logger.error("Error getting PDF info: %s", e)

    return info
