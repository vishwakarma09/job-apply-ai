from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://ai_job_apply_user:ai_job_apply_password@localhost:5432/ai_job_apply_db"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = False
    EMAILS_FROM_EMAIL: str = "noreply@jobapply.ai"
    FRONTEND_URL: str = "http://localhost:5173"
    JWT_SECRET: str = "super_secret_ai_job_apply_key_998877"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600
    
    # AI and SSO Integration
    CEREBRAS_API_KEY: str = "YOUR_CEREBRAS_API_KEY"
    GOOGLE_CLIENT_ID: str = "YOUR_GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET: str = "YOUR_GOOGLE_CLIENT_SECRET"
    EXTENSION_FRONTEND_URL: str = "http://localhost:5173"
    
    # Billing
    STRIPE_API_KEY: str = "sk_test_51P1t1..." # Default dummy placeholder, can be overridden by env
    STRIPE_WEBHOOK_SECRET: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
