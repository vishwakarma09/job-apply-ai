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
        existing.status = "Connected"
        existing.last_sync_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
        
    connector = models.Connector(
        user_id=current_user.id,
        platform_name=connector_in.platform_name,
        credentials_json=connector_in.credentials_json,
        status="Connected",
        last_sync_at=datetime.datetime.utcnow()
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)
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
