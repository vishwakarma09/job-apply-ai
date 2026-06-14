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
