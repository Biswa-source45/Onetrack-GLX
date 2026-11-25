import os
import sys
import time
from pathlib import Path

# Ensure ai_service directory is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

try:
    from models import ExtractionResponse, ExtractionMeta, TenderExtractedData, LeadExtractedData
    from extractor import extract_text_from_file, extract_tender_with_llm, extract_lead_with_llm
except ImportError:
    from ai_service.models import ExtractionResponse, ExtractionMeta, TenderExtractedData, LeadExtractedData
    from ai_service.extractor import extract_text_from_file, extract_tender_with_llm, extract_lead_with_llm

# Auto-load .env from current directory or backend/.env
env_paths = [
    BASE_DIR / ".env",
    BASE_DIR.parent / "backend" / ".env",
    Path("backend/.env"),
]
for p in env_paths:
    if p.exists():
        load_dotenv(dotenv_path=p)
        break

app = FastAPI(
    title="OneTrack AI Tender Extraction Microservice",
    description="High-precision unstructured document extraction microservice with mathematical 1-100% accuracy scoring.",
    version="1.0.0"
)

# Enable CORS for React frontend & local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@app.get("/health", tags=["System"])
def health_check():
    api_key_configured = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "healthy",
        "service": "tender-extractor-ai",
        "version": "1.0.0",
        "openai_configured": api_key_configured
    }

@app.post("/api/v1/extract-document", response_model=ExtractionResponse, tags=["Extraction"])
async def extract_document(
    file: UploadFile = File(..., description="Tender or Lead document (.pdf, .docx, .txt)"),
    model: str = Query("gpt-4o-mini", description="OpenAI model name"),
    mode: Optional[str] = Form(None, description="Extraction mode: 'tender' or 'lead'"),
    mode_param: Optional[str] = Query(None, alias="mode", description="Extraction mode: 'tender' or 'lead'")
):
    """
    Upload an unstructured tender or lead document and extract all fields with a 1-100% accuracy calculation.
    Supports mode='tender' (default) or mode='lead' under the exact same endpoint URL.
    """
    start_time = time.time()
    active_mode = (mode_param or mode or "tender").lower().strip()

    # Validate file extension
    filename = file.filename or "unknown.pdf"
    ext = filename.lower().split(".")[-1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 25MB (got {len(content) / (1024*1024):.1f}MB)"
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Check OpenAI API Key
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured in backend/.env or environment variables."
        )

    try:
        # Step 1: Extract text from file
        raw_text, pages_count, file_type = extract_text_from_file(content, filename)
        if not raw_text or len(raw_text.strip()) < 20:
            raise HTTPException(
                status_code=422,
                detail="Could not extract readable text from the document. The file may be a scanned image or empty."
            )

        # Step 2: Extract structured data with LLM & calculate accuracy (1-100%)
        if active_mode in ("lead", "leads"):
            extracted_data, accuracy_pct, grade, breakdown = await extract_lead_with_llm(
                raw_text=raw_text,
                api_key=api_key,
                model=model
            )
        else:
            extracted_data, accuracy_pct, grade, breakdown = await extract_tender_with_llm(
                raw_text=raw_text,
                api_key=api_key,
                model=model
            )

        elapsed_ms = int((time.time() - start_time) * 1000)

        meta = ExtractionMeta(
            filename=filename,
            file_type=file_type,
            pages_read=pages_count,
            character_count=len(raw_text),
            extraction_time_ms=elapsed_ms,
            accuracy_percentage=accuracy_pct,
            accuracy_grade=grade,
            accuracy_breakdown=breakdown,
            model_used=model
        )

        return ExtractionResponse(
            success=True,
            data=extracted_data,
            meta=meta
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )


@app.post("/api/v1/extract-lead", response_model=ExtractionResponse, tags=["Extraction"])
async def extract_lead(
    file: UploadFile = File(..., description="Lead / RFP document (.pdf, .docx, .txt)"),
    model: str = Query("gpt-4o-mini", description="OpenAI model name")
):
    """
    Dedicated alias endpoint for lead extraction.
    """
    return await extract_document(file=file, model=model, mode="lead", mode_param="lead")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
