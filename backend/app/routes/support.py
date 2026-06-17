from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/support", tags=["Support & FAQ"])

@router.post("", response_model=schemas.SupportTicketResponse, status_code=201)
def create_support_ticket(ticket_in: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    ticket = models.SupportTicket(
        name=ticket_in.name,
        email=ticket_in.email,
        subject=ticket_in.subject,
        message=ticket_in.message
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
