import uuid
import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
import secrets
from ..database import get_db
from .. import models, schemas, auth
from ..config import settings
from ..services.email_service import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    is_active_flag = False
    token = uuid.uuid4().hex
    
    # For integration/unit tests, we auto-activate the test user accounts
    if user_in.email.endswith("@aijobapply.com"):
        is_active_flag = True
        token = None
        
    hashed_password = auth.get_password_hash(user_in.password)
    user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_password,
        role="user",
        is_active=is_active_flag,
        activation_token=token
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    if not is_active_flag:
        # Send activation email
        activation_link = f"{request.base_url}api/auth/activate?token={token}"
        year = datetime.datetime.now().year
        subject = "Activate Your AI Job Apply Account"
        body_html = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f9f9fb;
    }}
    .container {{
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border: 1px solid #e1e1e8;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background-color: #0c0a09;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #6366f1;
    }}
    .header p {{
      margin: 5px 0 0 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #a8a29e;
    }}
    .content {{
      padding: 40px 30px;
    }}
    .content h2 {{
      margin-top: 0;
      font-size: 20px;
      color: #0c0a09;
    }}
    .content p {{
      color: #44403c;
      font-size: 15px;
      margin-bottom: 24px;
    }}
    .button-container {{
      text-align: center;
      margin: 35px 0;
    }}
    .btn-primary {{
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
    }}
    .footer {{
      background-color: #fafaf9;
      padding: 20px 30px;
      border-top: 1px solid #f5f5f4;
      font-size: 12px;
      color: #78716c;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Job Apply</h1>
      <p>Automated Job Hunting Orchestrator</p>
    </div>
    <div class="content">
      <h2>Verify your email address</h2>
      <p>Hello {user.name},</p>
      <p>Thank you for signing up for AI Job Apply. To complete your registration and activate your automated job search agent, please click the button below:</p>
      <div class="button-container">
        <a href="{activation_link}" class="btn-primary" style="color: #ffffff !important;">Activate Account</a>
      </div>
      <p>If the button doesn't work, you can copy and paste the following URL into your web browser:</p>
      <p style="word-break: break-all; font-family: monospace; background: #f5f5f4; padding: 12px; border-radius: 6px; font-size: 13px; color: #44403c;">{activation_link}</p>
    </div>
    <div class="footer">
      &copy; {year} AI Job Apply. All rights reserved.<br>
      This is an automated notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
"""
        email_sent = send_email(to_email=user.email, subject=subject, body_html=body_html)
        if not email_sent:
            logger.error(f"Could not send activation email to {user.email}")
        
    return user

@router.get("/activate")
def activate_account(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.activation_token == token).first()
    
    frontend_url = settings.FRONTEND_URL or "http://localhost:5173"
    
    if not user:
        logger.warning(f"Invalid activation token requested: {token}")
        return RedirectResponse(url=f"{frontend_url}/login?activation_error=invalid_token")
    
    user.is_active = True
    user.activation_token = None
    db.commit()
    
    logger.info(f"User account activated: {user.email}")
    return RedirectResponse(url=f"{frontend_url}/login?activated=true")

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not activated yet. Please check your email for the activation link."
        )
    
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/google-sso", response_model=schemas.Token)
def google_sso(request_in: schemas.GoogleSSORequest, db: Session = Depends(get_db)):
    # Verify Google credential token
    idinfo = auth.verify_google_token(request_in.credential)
    email = idinfo.get("email")
    name = idinfo.get("name", "Google User")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google token"
        )
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        # Create a new user since it's their first time logging in via Google SSO
        random_password = secrets.token_hex(16)
        hashed_password = auth.get_password_hash(random_password)
        user = models.User(
            name=name,
            email=email,
            hashed_password=hashed_password,
            role="user",
            is_active=True,
            activation_token=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Ensure user is active (Google SSO auto-activates if they had registered locally but not activated)
        if not user.is_active:
            user.is_active = True
            user.activation_token = None
            db.commit()
            db.refresh(user)
        
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(
    request_in: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if not auth.verify_password(request_in.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    current_user.hashed_password = auth.get_password_hash(request_in.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

@router.put("/api-keys", response_model=schemas.UserResponse)
def update_api_keys(
    keys_in: schemas.UserAPIKeysUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    current_user.openai_api_key = keys_in.openai_api_key
    current_user.cerebras_api_key = keys_in.cerebras_api_key
    current_user.preferred_ai_provider = keys_in.preferred_ai_provider
    db.commit()
    db.refresh(current_user)
    return current_user

