from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth, security_utils
from ..services import email_service

router = APIRouter(prefix="/api/email-credentials", tags=["Email Credentials"])

@router.get("", response_model=schemas.EmailCredentialResponse)
def get_email_credentials(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    credentials = db.query(models.EmailCredential).filter(
        models.EmailCredential.user_id == current_user.id
    ).first()
    if not credentials:
        raise HTTPException(status_code=404, detail="Email credentials not configured")
    return credentials

@router.post("", response_model=schemas.EmailCredentialResponse)
def create_or_update_email_credentials(
    payload: schemas.EmailCredentialCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    cleaned_email = email_service.clean_str(payload.email)
    cleaned_smtp_host = email_service.clean_str(payload.smtp_host)
    cleaned_smtp_pass = email_service.clean_str(payload.smtp_password)
    cleaned_imap_host = email_service.clean_str(payload.imap_host)
    cleaned_imap_pass = email_service.clean_str(payload.imap_password)

    encrypted_smtp = security_utils.encrypt_password(cleaned_smtp_pass)
    encrypted_imap = security_utils.encrypt_password(cleaned_imap_pass)

    existing = db.query(models.EmailCredential).filter(
        models.EmailCredential.user_id == current_user.id
    ).first()

    if existing:
        existing.email_provider = payload.email_provider
        existing.email = cleaned_email
        existing.smtp_host = cleaned_smtp_host
        existing.smtp_port = payload.smtp_port
        existing.encrypted_smtp_password = encrypted_smtp
        existing.imap_host = cleaned_imap_host
        existing.imap_port = payload.imap_port
        existing.encrypted_imap_password = encrypted_imap
        db.commit()
        db.refresh(existing)
        return existing

    new_cred = models.EmailCredential(
        user_id=current_user.id,
        email_provider=payload.email_provider,
        email=cleaned_email,
        smtp_host=cleaned_smtp_host,
        smtp_port=payload.smtp_port,
        encrypted_smtp_password=encrypted_smtp,
        imap_host=cleaned_imap_host,
        imap_port=payload.imap_port,
        encrypted_imap_password=encrypted_imap
    )
    db.add(new_cred)
    db.commit()
    db.refresh(new_cred)
    return new_cred

@router.delete("")
def delete_email_credentials(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    credentials = db.query(models.EmailCredential).filter(
        models.EmailCredential.user_id == current_user.id
    ).first()
    if not credentials:
        raise HTTPException(status_code=404, detail="Email credentials not found")
    db.delete(credentials)
    db.commit()
    return {"message": "Email credentials deleted successfully"}

@router.post("/test")
def test_credentials(
    payload: schemas.EmailCredentialTestRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    smtp_ok = email_service.test_smtp_connection(
        payload.smtp_host,
        payload.smtp_port,
        payload.email,
        payload.smtp_password
    )
    
    imap_ok = email_service.test_imap_connection(
        payload.imap_host,
        payload.imap_port,
        payload.email,
        payload.imap_password
    )
    
    return {
        "smtp_connected": smtp_ok,
        "imap_connected": imap_ok,
        "success": smtp_ok and imap_ok
    }

@router.post("/poll-otp")
def poll_otp(
    sender_filter: str = None,
    subject_filter: str = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    credentials = db.query(models.EmailCredential).filter(
        models.EmailCredential.user_id == current_user.id
    ).first()
    if not credentials:
        raise HTTPException(status_code=404, detail="Email credentials not configured")
    
    smtp_pass = security_utils.decrypt_password(credentials.encrypted_smtp_password)
    imap_pass = security_utils.decrypt_password(credentials.encrypted_imap_password)
    
    otp = email_service.fetch_latest_otp(
        host=credentials.imap_host,
        port=credentials.imap_port,
        username=credentials.email,
        password=imap_pass,
        sender_filter=sender_filter,
        subject_filter=subject_filter,
        timeout_seconds=30
    )
    
    if not otp:
        raise HTTPException(status_code=404, detail="OTP code not found. Make sure the email was sent and contains a code.")
    
    return {"otp": otp}
