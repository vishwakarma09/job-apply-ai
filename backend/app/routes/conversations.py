from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/conversations", tags=["Recruiter Conversations"])

@router.get("/{job_id}", response_model=List[schemas.ConversationResponse])
def get_conversations(
    job_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Verify job belongs to user
    job = db.query(models.AppliedJob).filter(
        models.AppliedJob.id == job_id,
        models.AppliedJob.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    return job.conversations

@router.post("/{job_id}", response_model=schemas.ConversationResponse)
def add_conversation(
    job_id: int,
    convo_in: schemas.ConversationCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Verify job belongs to user
    job = db.query(models.AppliedJob).filter(
        models.AppliedJob.id == job_id,
        models.AppliedJob.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
        
    db_convo = models.Conversation(
        applied_job_id=job.id,
        sender=convo_in.sender,
        message_text=convo_in.message_text,
        platform=convo_in.platform
    )
    db.add(db_convo)
    db.commit()
    db.refresh(db_convo)
    return db_convo
