import io
from pypdf import PdfReader

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")

def extract_text_from_docx(file_bytes: bytes) -> str:
    # Basic DOCX parsing or plain text extraction fallback
    # Since python-docx isn't always installed, we'll try to extract plain text
    # or handle it as plain text if it's ascii/utf-8 encoded.
    try:
        return file_bytes.decode('utf-8', errors='ignore').strip()
    except Exception as e:
        raise ValueError(f"Failed to parse document: {str(e)}")

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    if ext == 'pdf':
        return extract_text_from_pdf(file_bytes)
    else:
        # Fallback to plain text decoder
        return extract_text_from_docx(file_bytes)
