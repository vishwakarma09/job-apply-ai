from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/connectors", tags=["Connectors"])

@router.get("", response_model=List[schemas.ConnectorResponse])
def get_connectors(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Connector).filter(models.Connector.user_id == current_user.id).all()


def sync_connector_security_questions(db: Session, connector: models.Connector):
    # Delete existing security questions for this connector
    db.query(models.ConnectorSecurityQuestion).filter(
        models.ConnectorSecurityQuestion.connector_id == connector.id
    ).delete()
    db.commit()

    if not connector.credentials_json:
        return

    import json
    try:
        credentials = json.loads(connector.credentials_json)
    except Exception:
        return

    if not isinstance(credentials, dict):
        return

    security_questions = credentials.get("security_questions", [])
    if not isinstance(security_questions, list):
        return

    from ..services.embedding_service import get_embedding
    for sq in security_questions:
        question = sq.get("question")
        answer = sq.get("answer")
        if question and answer:
            q_emb = get_embedding(question)
            db_sq = models.ConnectorSecurityQuestion(
                connector_id=connector.id,
                question=question,
                answer=answer,
                question_embedding=q_emb
            )
            db.add(db_sq)
    db.commit()


@router.post("", response_model=schemas.ConnectorResponse)
def add_connector(
    connector_in: schemas.ConnectorCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user already has a connector for this platform
    existing = db.query(models.Connector).filter(
        models.Connector.user_id == current_user.id,
        models.Connector.platform_name == connector_in.platform_name
    ).first()
    
    if existing:
        # Update credentials instead of creating a new one
        existing.credentials_json = connector_in.credentials_json
        existing.status = connector_in.status
        existing.last_sync_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        sync_connector_security_questions(db, existing)
        return existing
        
    connector = models.Connector(
        user_id=current_user.id,
        platform_name=connector_in.platform_name,
        credentials_json=connector_in.credentials_json,
        status=connector_in.status,
        last_sync_at=datetime.datetime.utcnow()
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)
    sync_connector_security_questions(db, connector)
    return connector

@router.put("/{connector_id}", response_model=schemas.ConnectorResponse)
def update_connector(
    connector_id: int,
    connector_in: schemas.ConnectorUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.user_id == current_user.id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
        
    for field, val in connector_in.dict(exclude_unset=True).items():
        setattr(connector, field, val)
        
    db.commit()
    db.refresh(connector)
    if connector_in.credentials_json is not None:
        sync_connector_security_questions(db, connector)
    return connector

@router.delete("/{connector_id}")
def delete_connector(
    connector_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.user_id == current_user.id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
        
    db.delete(connector)
    db.commit()
    return {"message": "Connector deleted successfully"}


@router.post("/match-security-question")
def match_security_question(
    payload: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    platform_name = payload.get("platform_name")
    question_text = payload.get("question_text")
    if not platform_name or not question_text:
        raise HTTPException(status_code=400, detail="platform_name and question_text are required")

    # Find the user's connector for this platform
    connector = db.query(models.Connector).filter(
        models.Connector.user_id == current_user.id,
        models.Connector.platform_name == platform_name
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    # Generate embedding for the question
    from ..services.embedding_service import get_embedding
    qv = get_embedding(question_text)
    qv_str = "[" + ",".join(map(str, qv)) + "]"

    # Perform cosine similarity query against connector_security_questions using pgvector
    from sqlalchemy import text
    stmt = text("""
        SELECT question, answer, 1 - (question_embedding <=> :qv) AS similarity
        FROM connector_security_questions
        WHERE connector_id = :connector_id AND TRIM(answer) != ''
        ORDER BY question_embedding <=> :qv
        LIMIT 1
    """)
    
    row = db.execute(stmt, {"qv": qv_str, "connector_id": connector.id}).fetchone()
    
    if row:
        return {
            "matched": True,
            "question": row.question,
            "answer": row.answer,
            "similarity": float(row.similarity)
        }
    
    return {"matched": False}
