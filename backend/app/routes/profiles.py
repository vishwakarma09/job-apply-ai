from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from ..database import get_db
from .. import models, schemas, auth
from ..services import resume_service

router = APIRouter(prefix="/api/profiles", tags=["Profiles & Resumes"])

UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    return profile

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
    return db_profile
