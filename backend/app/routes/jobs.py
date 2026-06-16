from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
from ..database import get_db
from .. import models, schemas, auth
from ..services import cerebras_service

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.get("", response_model=List[schemas.AppliedJobResponse])
def get_applied_jobs(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.AppliedJob).filter(models.AppliedJob.user_id == current_user.id).all()

@router.post("", response_model=schemas.AppliedJobResponse)
def add_applied_job(
    job_in: schemas.AppliedJobCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Validate profile belongs to user if provided
    if job_in.job_profile_id:
        profile = db.query(models.JobProfile).filter(
            models.JobProfile.id == job_in.job_profile_id,
            models.JobProfile.user_id == current_user.id
        ).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Job profile not found")
            
    db_job = models.AppliedJob(
        user_id=current_user.id,
        job_profile_id=job_in.job_profile_id,
        platform_name=job_in.platform_name,
        title=job_in.title,
        company_name=job_in.company_name,
        location=job_in.location,
        salary=job_in.salary,
        job_url=job_in.job_url,
        status=job_in.status,
        applied_date=job_in.applied_date
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job

@router.get("/{job_id}", response_model=schemas.AppliedJobResponse)
def get_job_detail(
    job_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(models.AppliedJob).filter(
        models.AppliedJob.id == job_id,
        models.AppliedJob.user_id == current_user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    return job

@router.put("/{job_id}", response_model=schemas.AppliedJobResponse)
def update_applied_job(
    job_id: int,
    job_in: schemas.AppliedJobUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(models.AppliedJob).filter(
        models.AppliedJob.id == job_id,
        models.AppliedJob.user_id == current_user.id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    for field, val in job_in.dict(exclude_unset=True).items():
        setattr(job, field, val)
        
    db.commit()
    db.refresh(job)
    return job

@router.post("/generate-cover-letter", response_model=schemas.CoverLetterGenerateResponse)
def generate_cover_letter_endpoint(
    req: schemas.CoverLetterGenerateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.id == req.job_profile_id,
        models.JobProfile.user_id == current_user.id
    ).first()
    if not profile or not profile.resume:
        raise HTTPException(status_code=400, detail="Active job profile does not contain an uploaded resume")
        
    cover_letter_content = cerebras_service.generate_cover_letter(
        resume_text=profile.resume.extracted_text or "",
        job_description=req.job_description
    )
    
    # Generate PDF in memory using ReportLab
    import base64
    from io import BytesIO
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=54, leftMargin=54,
                                topMargin=54, bottomMargin=54)
        styles = getSampleStyleSheet()
        body_style = ParagraphStyle(
            'CoverLetterBody',
            parent=styles['Normal'],
            fontSize=11,
            leading=15,
            spaceAfter=10
        )
        story = []
        paragraphs = cover_letter_content.split("\n\n")
        for p in paragraphs:
            p_clean = p.strip().replace("\n", "<br/>")
            if p_clean:
                story.append(Paragraph(p_clean, body_style))
                story.append(Spacer(1, 10))
        doc.build(story)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    except Exception as pdf_err:
        raise HTTPException(status_code=500, detail=f"Failed to generate cover letter PDF: {str(pdf_err)}")
        
    return {
        "content": cover_letter_content,
        "pdf_base64": pdf_base64
    }

@router.post("/{job_id}/tailor", response_model=schemas.CoverLetterResponse)
def tailor_job_application(
    job_id: int,
    tailor_in: schemas.TailorRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Verify job exists
    job = db.query(models.AppliedJob).filter(
        models.AppliedJob.id == job_id,
        models.AppliedJob.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    # Verify profile exists and has resume
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.id == tailor_in.job_profile_id,
        models.JobProfile.user_id == current_user.id
    ).first()
    if not profile or not profile.resume:
        raise HTTPException(status_code=400, detail="Active job profile does not contain an uploaded resume")
        
    # Call Cerebras Service to tailor cover letter
    cover_letter_content = cerebras_service.generate_cover_letter(
        resume_text=profile.resume.extracted_text or "",
        job_description=tailor_in.job_description
    )
    
    # Save cover letter
    if job.cover_letter:
        job.cover_letter.content = cover_letter_content
        db_cover_letter = job.cover_letter
    else:
        db_cover_letter = models.CoverLetter(
            applied_job_id=job.id,
            content=cover_letter_content
        )
        db.add(db_cover_letter)
        
    db.commit()
    db.refresh(db_cover_letter)
    return db_cover_letter

@router.post("/extension-logs")
def create_extension_log(
    log_in: schemas.ExtensionLogCreate,
    current_user: models.User = Depends(auth.get_current_user)
):
    # Log details to docker/console stdout stream for analysis
    timestamp = log_in.timestamp or datetime.datetime.utcnow().isoformat()
    print(
        f"[EXTENSION LOG] {timestamp} - User: {current_user.email} - "
        f"[{log_in.level}] - Job ID: {log_in.job_id or 'N/A'} - Platform: {log_in.platform or 'N/A'} - "
        f"Msg: {log_in.message}",
        flush=True
)
    return {"status": "ok"}

def is_generic_ui_question(question: str) -> bool:
    q_lower = question.strip().lower()
    if not q_lower:
        return True
    # Ignore very short labels/values
    if len(q_lower) < 3:
        return True
    # Ignore purely numeric labels
    if q_lower.replace(".", "").replace(",", "").isdigit():
        return True
        
    ui_keywords = {
        "continue", "next", "submit", "back", "cancel", "close", "clear", 
        "go to", "pick a date", "previous", "share", "copy", "ok", "got it", 
        "yes", "no", "save", "date picker", "month", "year", "day", 
        "select", "choose", "button", "menu", "navigation", "search", 
        "filter", "collapse", "expand", "dismiss", "sign in", "log in", 
        "log out", "sign out", "register", "apply", "easy apply", "quick apply",
        "copy link", "share this", "view details", "estimated pay", "job details",
        "upload resume", "upload", "choose file"
    }
    
    if q_lower in ui_keywords:
        return True
        
    generic_phrases = [
        "go to next", "go to previous", "pick a date", "copy job link", 
        "share this job", "view job", "read more", "show more", "hide",
        "terms of service", "privacy policy", "all rights reserved",
        "close modal", "dismiss alert", "cookie settings", "previous month", 
        "next month", "page number", "site navigation", "close popup"
    ]
    if any(phrase in q_lower for phrase in generic_phrases):
        return True
        
    return False

@router.post("/solve-screen")
def solve_screen_endpoint(
    payload: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile_data = payload.get("profile", {})
    url = payload.get("url", "")
    title = payload.get("title", "")
    heading = payload.get("heading", "")
    fields = payload.get("fields", [])
    
    try:
        from ..services.embedding_service import get_embedding
        from sqlalchemy import text
        
        # 1. Fetch semantic RAG context from postgres pgvector
        rag_context = []
        seen_questions = set()
        for f in fields:
            label = f.get("label")
            if not label:
                continue
            
            label_clean = label.strip()
            if label_clean in seen_questions:
                continue
            seen_questions.add(label_clean)
            
            # Vectorize label
            embedding = get_embedding(label_clean)
            qv_str = "[" + ",".join(map(str, embedding)) + "]"
            
            stmt = text("""
                SELECT question, answer, 1 - (question_embedding <=> :qv) AS similarity
                FROM user_knowledgebase
                WHERE user_id = :user_id AND TRIM(answer) != ''
                ORDER BY question_embedding <=> :qv
                LIMIT 1
            """)
            
            has_match = False
            try:
                row = db.execute(stmt, {"qv": qv_str, "user_id": current_user.id}).fetchone()
                if row:
                    if row.similarity >= 0.60:
                        has_match = True
                        rag_context.append({
                            "question": row.question,
                            "answer": row.answer,
                            "similarity": float(row.similarity)
                        })
            except Exception as query_err:
                print(f"Error querying user_knowledgebase for RAG: {query_err}")
                
            is_required = f.get("required") is True or str(f.get("required")).lower() == "true"
            if not has_match and is_required and not is_generic_ui_question(label_clean):
                # Check if this exact question exists
                existing_entry = db.query(models.UserKnowledgebase).filter(
                    models.UserKnowledgebase.user_id == current_user.id,
                    models.UserKnowledgebase.question == label_clean
                ).first()
                if not existing_entry:
                    new_kb = models.UserKnowledgebase(
                        user_id=current_user.id,
                        question=label_clean,
                        answer="", # unanswered
                        question_embedding=embedding
                    )
                    db.add(new_kb)
                    db.commit()
                    
        # 2. Call AI Solver passing the RAG context
        from ..services import cerebras_service
        result = cerebras_service.solve_screen(profile_data, url, title, heading, fields, rag_context)
        
        # 3. Auto-learn/cache LLM solver results
        if result and result.get("action") == "fill" and result.get("fields"):
            # Get active profile
            profile = db.query(models.JobProfile).filter(
                models.JobProfile.user_id == current_user.id,
                models.JobProfile.is_active == True
            ).first()
            if not profile:
                profile = db.query(models.JobProfile).filter(
                    models.JobProfile.user_id == current_user.id
                ).first()
                
            if profile:
                import json
                try:
                    existing = json.loads(profile.answers_json) if profile.answers_json else {}
                except Exception:
                    existing = {}
                
                for f in result["fields"]:
                    label = None
                    for pf in fields:
                        if (pf.get("id") == f.get("id") or pf.get("name") == f.get("name")) and pf.get("label"):
                            label = pf["label"]
                            break
                    if label:
                        q_clean = label.strip()
                        a_clean = str(f.get("value")).strip()
                        
                        existing[q_clean.lower()] = a_clean
                        
                        # Save to user_knowledgebase table with embedding
                        kb_entry = db.query(models.UserKnowledgebase).filter(
                            models.UserKnowledgebase.user_id == current_user.id,
                            models.UserKnowledgebase.question == q_clean
                        ).first()
                        
                        embedding = get_embedding(q_clean)
                        if kb_entry:
                            kb_entry.answer = a_clean
                            kb_entry.question_embedding = embedding
                        else:
                            kb_entry = models.UserKnowledgebase(
                                user_id=current_user.id,
                                question=q_clean,
                                answer=a_clean,
                                question_embedding=embedding
                            )
                            db.add(kb_entry)
                
                profile.answers_json = json.dumps(existing)
                db.commit()
                
        return result
    except Exception as e:
        print(f"Error solving screen via LLM: {e}")
        return {"action": "wait", "fields": [], "click_button": None}


