from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import datetime

# --- User & Auth Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    is_premium: bool
    premium_until: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class GoogleSSORequest(BaseModel):
    credential: str

# --- Resume Schemas ---
class ResumeBase(BaseModel):
    filename: str

class ResumeResponse(ResumeBase):
    id: int
    user_id: int
    file_path: str
    extracted_text: Optional[str] = None
    uploaded_at: datetime.datetime

    class Config:
        from_attributes = True

# --- JobProfile Schemas ---
class JobProfileBase(BaseModel):
    title: str
    is_active: bool = False
    resume_id: Optional[int] = None
    
    # Knowledge Base Auto-fill fields
    phone: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    city: Optional[str] = None
    nationality: Optional[str] = None
    visa_sponsorship: Optional[str] = None
    disability_status: Optional[str] = None
    veteran_status: Optional[str] = None
    ethnicity: Optional[str] = None
    gender: Optional[str] = None
    languages: Optional[str] = None
    skills: Optional[str] = None
    work_authorization: Optional[str] = None
    answers_json: Optional[str] = "{}"

class JobProfileCreate(JobProfileBase):
    pass

class JobProfileUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None
    resume_id: Optional[int] = None
    
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    nationality: Optional[str] = None
    visa_sponsorship: Optional[str] = None
    disability_status: Optional[str] = None
    veteran_status: Optional[str] = None
    ethnicity: Optional[str] = None
    gender: Optional[str] = None
    languages: Optional[str] = None
    skills: Optional[str] = None
    work_authorization: Optional[str] = None
    answers_json: Optional[str] = None

class JobProfileResponse(JobProfileBase):
    id: int
    user_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    resume_text: Optional[str] = None

    class Config:
        from_attributes = True

# --- Connector Schemas ---
class ConnectorBase(BaseModel):
    platform_name: str
    credentials_json: Optional[str] = None
    status: str = "Connected"

class ConnectorCreate(ConnectorBase):
    pass

class ConnectorUpdate(BaseModel):
    credentials_json: Optional[str] = None
    status: Optional[str] = None
    last_sync_at: Optional[datetime.datetime] = None

class ConnectorResponse(ConnectorBase):
    id: int
    user_id: int
    last_sync_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- CoverLetter Schemas ---
class CoverLetterGenerateRequest(BaseModel):
    job_profile_id: int
    job_description: str

class CoverLetterGenerateResponse(BaseModel):
    content: str
    pdf_base64: str

class CoverLetterBase(BaseModel):
    content: str

class CoverLetterResponse(CoverLetterBase):
    id: int
    applied_job_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Conversation Schemas ---
class ConversationBase(BaseModel):
    sender: str
    message_text: str
    platform: str = "email"

class ConversationCreate(ConversationBase):
    pass

class ConversationResponse(ConversationBase):
    id: int
    applied_job_id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

# --- AppliedJob Schemas ---
class AppliedJobBase(BaseModel):
    platform_name: str
    title: str
    company_name: str
    location: Optional[str] = None
    salary: Optional[str] = None
    job_url: Optional[str] = None
    status: str = "applied"
    applied_date: datetime.date = datetime.date.today()
    job_profile_id: Optional[int] = None

class AppliedJobCreate(AppliedJobBase):
    pass

class AppliedJobUpdate(BaseModel):
    status: Optional[str] = None
    job_profile_id: Optional[int] = None
    salary: Optional[str] = None
    location: Optional[str] = None

class AppliedJobResponse(AppliedJobBase):
    id: int
    user_id: int
    updated_at: datetime.datetime
    cover_letter: Optional[CoverLetterResponse] = None
    conversations: List[ConversationResponse] = []

    class Config:
        from_attributes = True

# --- Tailor Request ---
class TailorRequest(BaseModel):
    job_description: str
    job_profile_id: int

# --- Billing Schemas ---
class PlanResponse(BaseModel):
    id: int
    name: str
    price: float
    stripe_price_id: Optional[str] = None
    features_json: str

    class Config:
        from_attributes = True

class DiscountResponse(BaseModel):
    id: int
    code: str
    percentage: float
    is_one_time: bool
    is_active: bool

    class Config:
        from_attributes = True

class OrderItemResponse(BaseModel):
    id: int
    plan_id: int
    quantity: int
    price: float

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: str
    total_amount: float
    discount_amount: float
    final_amount: float
    discount_id: Optional[int] = None
    stripe_session_id: Optional[str] = None
    created_at: datetime.datetime
    order_items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True

class CheckoutSessionCreate(BaseModel):
    plan_id: int
    promo_code: Optional[str] = None

# --- Extension Log Schemas ---
class ExtensionLogCreate(BaseModel):
    level: str
    message: str
    timestamp: Optional[str] = None
    job_id: Optional[str] = None
    platform: Optional[str] = None

# --- UserKnowledgebase Schemas ---
class UserKnowledgebaseBase(BaseModel):
    question: str
    answer: str

class UserKnowledgebaseCreate(UserKnowledgebaseBase):
    pass

class UserKnowledgebaseResponse(UserKnowledgebaseBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- EmailCredential Schemas ---
class EmailCredentialBase(BaseModel):
    email_provider: str = "Gmail"
    email: EmailStr
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    imap_host: str = "imap.gmail.com"
    imap_port: int = 993

class EmailCredentialCreate(EmailCredentialBase):
    smtp_password: Optional[str] = None
    imap_password: Optional[str] = None

class EmailCredentialUpdate(BaseModel):
    email_provider: Optional[str] = None
    email: Optional[EmailStr] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_password: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_password: Optional[str] = None

class EmailCredentialResponse(EmailCredentialBase):
    id: int
    user_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

class EmailCredentialTestRequest(BaseModel):
    email_provider: str
    email: EmailStr
    smtp_host: str
    smtp_port: int
    smtp_password: Optional[str] = None
    imap_host: str
    imap_port: int
    imap_password: Optional[str] = None


