from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from ..database import get_db
from .. import models, schemas, auth
from ..services import resume_service

router = APIRouter(prefix="/api/profiles", tags=["Profiles & Resumes"])

UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def deduce_basic_profile_answer(question: str, user: models.User, db: Session) -> Optional[str]:
    if not question:
        return None
    
    # 1. Sync active or first profile to knowledgebase to ensure all profile values are current
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.user_id == user.id,
        models.JobProfile.is_active == True
    ).first()
    if not profile:
        profile = db.query(models.JobProfile).filter(
            models.JobProfile.user_id == user.id
        ).first()
        
    if profile:
        try:
            sync_profile_to_knowledgebase(db, profile)
        except Exception as sync_err:
            print(f"Error syncing profile to knowledgebase during deduction: {sync_err}")

    # 2. Try manual/rule-based synonym matching first (extremely useful for local bag-of-words mock)
    q = question.strip().rstrip("*?: \t").lower()
    
    name_parts = user.name.split() if (user and user.name) else []
    first_name = name_parts[0] if len(name_parts) > 0 else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    first_name_triggers = {"first name", "given name", "first_name", "first-name"}
    last_name_triggers = {"last name", "family name", "surname", "last_name", "last-name"}
    full_name_triggers = {"full name", "first and last name", "your name"}
    
    email_triggers = {"email", "email address", "email_address", "email-address"}
    phone_triggers = {"phone", "phone number", "mobile", "cell phone", "phone_number", "phone-number", "mobile number"}
    city_triggers = {"city", "location", "address city", "current city"}
    
    if q in first_name_triggers and first_name:
        return first_name
    if q in last_name_triggers and last_name:
        return last_name
    if q in full_name_triggers and user and user.name:
        return user.name
    if q in email_triggers:
        if profile and profile.email:
            return profile.email
        if user and user.email:
            return user.email
    if q in phone_triggers and profile and profile.phone:
        return profile.phone
    if q in city_triggers and profile and profile.city:
        return profile.city

    # 3. Fallback: Perform database semantic search (cosine similarity) to find closest answered question
    from ..services.embedding_service import get_embedding
    from sqlalchemy import text
    
    label_clean = question.strip()
    embedding = get_embedding(label_clean)
    qv_str = "[" + ",".join(map(str, embedding)) + "]"
    
    stmt = text("""
        SELECT question, answer, 1 - (question_embedding <=> :qv) AS similarity
        FROM user_knowledgebase
        WHERE user_id = :user_id AND TRIM(answer) != ''
        ORDER BY question_embedding <=> :qv
        LIMIT 1
    """)
    
    try:
        row = db.execute(stmt, {"qv": qv_str, "user_id": user.id}).fetchone()
        if row and row.similarity >= 0.65:
            return row.answer
    except Exception as query_err:
        print(f"Error searching knowledgebase for deduction: {query_err}")
        
    return None

def sync_profile_to_knowledgebase(db: Session, profile: models.JobProfile):
    from ..services.embedding_service import get_embedding
    
    user = profile.user or db.query(models.User).filter(models.User.id == profile.user_id).first()
    name_parts = user.name.split() if (user and user.name) else []
    first_name = name_parts[0] if len(name_parts) > 0 else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    fields_mapping = {
        "First Name": first_name,
        "Last Name": last_name,
        "Full Name": user.name if user else "",
        "Phone number": profile.phone,
        "Email address": profile.email or (user.email if user else ""),
        "City": profile.city,
        "Location": profile.city,
        "Desired job location": profile.city,
        "Nationality / Citizenship": profile.nationality,
        "Do you require visa sponsorship?": profile.visa_sponsorship,
        "Disability status": profile.disability_status,
        "Veteran status": profile.veteran_status,
        "Race / Ethnicity": profile.ethnicity,
        "Gender": profile.gender,
        "Languages spoken": profile.languages,
        "Technical skills": profile.skills,
        "Work authorization status": profile.work_authorization,
        "Job Title": profile.title
    }
    
    for question, answer in fields_mapping.items():
        if not answer:
            continue
            
        q_clean = question.strip()
        a_clean = str(answer).strip()
        
        # Check if it already exists in user_knowledgebase for this user
        kb_entry = db.query(models.UserKnowledgebase).filter(
            models.UserKnowledgebase.user_id == profile.user_id,
            models.UserKnowledgebase.question == q_clean
        ).first()
        
        embedding = get_embedding(q_clean)
        
        if kb_entry:
            kb_entry.answer = a_clean
            kb_entry.question_embedding = embedding
        else:
            kb_entry = models.UserKnowledgebase(
                user_id=profile.user_id,
                question=q_clean,
                answer=a_clean,
                question_embedding=embedding
            )
            db.add(kb_entry)
            
    db.commit()

@router.post("/upload-resume", response_model=schemas.ResumeResponse)
def upload_resume(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Save the file locally
    file_ext = file.filename.split('.')[-1].lower()
    filename = f"user_{current_user.id}_{int(os.path.getmtime(UPLOAD_DIR)) if os.path.exists(UPLOAD_DIR) else 0}.{file_ext}"
    # Let's generate a unique filename
    import time
    filename = f"user_{current_user.id}_{int(time.time())}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Read text
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        extracted_text = resume_service.extract_text_from_bytes(file_bytes, file.filename)
    except Exception as e:
        extracted_text = f"Failed to extract text automatically: {str(e)}"
        
    db_resume = models.Resume(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        extracted_text=extracted_text
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    return db_resume

@router.get("/resumes", response_model=List[schemas.ResumeResponse])
def get_resumes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Resume).filter(models.Resume.user_id == current_user.id).all()

@router.post("", response_model=schemas.JobProfileResponse)
def create_job_profile(
    profile_in: schemas.JobProfileCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # If is_active is True, set all other profiles inactive first
    if profile_in.is_active:
        db.query(models.JobProfile).filter(
            models.JobProfile.user_id == current_user.id
        ).update({models.JobProfile.is_active: False})
        
    db_profile = models.JobProfile(
        user_id=current_user.id,
        title=profile_in.title,
        is_active=profile_in.is_active,
        resume_id=profile_in.resume_id
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    sync_profile_to_knowledgebase(db, db_profile)
    return db_profile

@router.get("", response_model=List[schemas.JobProfileResponse])
def get_job_profiles(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.JobProfile).filter(models.JobProfile.user_id == current_user.id).all()

@router.get("/active", response_model=schemas.JobProfileResponse)
def get_active_profile(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.user_id == current_user.id,
        models.JobProfile.is_active == True
    ).first()
    
    if not profile:
        # Return first available profile if none is active
        profile = db.query(models.JobProfile).filter(
            models.JobProfile.user_id == current_user.id
        ).first()
        
    if not profile:
        raise HTTPException(status_code=404, detail="No job profiles found")
        
    name_parts = current_user.name.split() if current_user.name else []
    profile.first_name = name_parts[0] if len(name_parts) > 0 else ""
    profile.last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    profile.resume_text = profile.resume.extracted_text if (profile.resume and profile.resume.extracted_text) else None
    return profile

@router.post("/active/learn")
def learn_profile_answers(
    payload: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    import json
    # Get active profile
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.user_id == current_user.id,
        models.JobProfile.is_active == True
    ).first()
    if not profile:
        profile = db.query(models.JobProfile).filter(
            models.JobProfile.user_id == current_user.id
        ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No active profile found")
    
    new_answers = payload.get("answers", {})
    if not new_answers:
        return {"status": "ignored"}
    
    # Load existing answers
    try:
        existing = json.loads(profile.answers_json) if profile.answers_json else {}
    except Exception:
        existing = {}
        
    # Update existing with new answers (case-insensitive keys for normalization)
    for q, a in new_answers.items():
        if q and a is not None and str(a).strip() != "":
            existing[q.lower().strip()] = str(a).strip()
            
    profile.answers_json = json.dumps(existing)
    db.commit()

    # Update user_knowledgebase table for semantic search RAG
    from ..services.embedding_service import get_embedding
    for q, a in new_answers.items():
        if q and a is not None:
            q_clean = q.strip()
            a_clean = str(a).strip()
            if a_clean == "":
                continue  # Never learn/overwrite with empty answer
            
            # Check if it already exists
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
    db.commit()
    
    return {"status": "success", "total_learned": len(existing)}

@router.put("/{profile_id}", response_model=schemas.JobProfileResponse)
def update_job_profile(
    profile_id: int,
    profile_in: schemas.JobProfileUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_profile = db.query(models.JobProfile).filter(
        models.JobProfile.id == profile_id,
        models.JobProfile.user_id == current_user.id
    ).first()
    
    if not db_profile:
        raise HTTPException(status_code=404, detail="Job profile not found")
        
    if profile_in.is_active is not None and profile_in.is_active:
        # Reset all other profiles
        db.query(models.JobProfile).filter(
            models.JobProfile.user_id == current_user.id
        ).update({models.JobProfile.is_active: False})
        
    for field, val in profile_in.dict(exclude_unset=True).items():
        setattr(db_profile, field, val)
        
    db.commit()
    db.refresh(db_profile)
    sync_profile_to_knowledgebase(db, db_profile)
    return db_profile

@router.get("/knowledgebase", response_model=List[schemas.UserKnowledgebaseResponse])
def get_all_knowledgebase_entries(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-resolve basic unanswered questions from profile
    unanswered_entries = db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.user_id == current_user.id,
        models.UserKnowledgebase.answer == ""
    ).all()
    if unanswered_entries:
        has_updates = False
        from ..services.embedding_service import get_embedding
        for entry in unanswered_entries:
            deduced = deduce_basic_profile_answer(entry.question, current_user, db)
            if deduced:
                entry.answer = deduced
                entry.question_embedding = get_embedding(entry.question)
                has_updates = True
        if has_updates:
            db.commit()

    return db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.user_id == current_user.id
    ).order_by(models.UserKnowledgebase.created_at.desc()).all()

@router.get("/knowledgebase/unanswered", response_model=List[schemas.UserKnowledgebaseResponse])
def get_unanswered_questions(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-resolve basic unanswered questions from profile
    unanswered_entries = db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.user_id == current_user.id,
        models.UserKnowledgebase.answer == ""
    ).all()
    if unanswered_entries:
        has_updates = False
        from ..services.embedding_service import get_embedding
        for entry in unanswered_entries:
            deduced = deduce_basic_profile_answer(entry.question, current_user, db)
            if deduced:
                entry.answer = deduced
                entry.question_embedding = get_embedding(entry.question)
                has_updates = True
        if has_updates:
            db.commit()

    return db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.user_id == current_user.id,
        models.UserKnowledgebase.answer == ""
    ).all()

@router.put("/knowledgebase/{kb_id}", response_model=schemas.UserKnowledgebaseResponse)
def update_knowledgebase_entry(
    kb_id: int,
    payload: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    kb_entry = db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.id == kb_id,
        models.UserKnowledgebase.user_id == current_user.id
    ).first()
    if not kb_entry:
        raise HTTPException(status_code=404, detail="Knowledgebase entry not found")
    
    answer = payload.get("answer", "")
    kb_entry.answer = answer.strip()
    
    # Update embedding
    from ..services.embedding_service import get_embedding
    kb_entry.question_embedding = get_embedding(kb_entry.question)
    
    db.commit()
    db.refresh(kb_entry)
    return kb_entry

@router.get("/resumes/{resume_id}/download")
def download_resume(
    resume_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id,
        models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    path = resume.file_path
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), path)
        
    if not os.path.exists(path):
        path = os.path.join("uploads", "resumes", os.path.basename(resume.file_path))
        
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Resume file not found on disk at {resume.file_path}")
        
    from fastapi.responses import FileResponse
    return FileResponse(path, filename=resume.filename)


