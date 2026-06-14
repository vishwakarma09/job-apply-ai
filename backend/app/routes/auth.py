from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
import secrets
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    hashed_password = auth.get_password_hash(user_in.password)
    user = models.User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_password,
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
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
            role="user"
        )
        db.add(user)
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
