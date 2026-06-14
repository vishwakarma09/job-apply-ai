import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user") # admin, user
    stripe_customer_id = Column(String(100), nullable=True)
    is_premium = Column(Boolean, default=False)
    premium_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    job_profiles = relationship("JobProfile", back_populates="user", cascade="all, delete-orphan")
    connectors = relationship("Connector", back_populates="user", cascade="all, delete-orphan")
    applied_jobs = relationship("AppliedJob", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="resumes")
    job_profiles = relationship("JobProfile", back_populates="resume")

class JobProfile(Base):
    __tablename__ = "job_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False) # e.g. "Senior Software Developer"
    is_active = Column(Boolean, default=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)
    
    # Knowledge Base Auto-fill parameters
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    nationality = Column(String(100), nullable=True)
    visa_sponsorship = Column(String(100), nullable=True)
    disability_status = Column(String(100), nullable=True)
    veteran_status = Column(String(100), nullable=True)
    ethnicity = Column(String(100), nullable=True)
    gender = Column(String(50), nullable=True)
    languages = Column(String(255), nullable=True)
    skills = Column(Text, nullable=True)
    work_authorization = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="job_profiles")
    resume = relationship("Resume", back_populates="job_profiles")
    applied_jobs = relationship("AppliedJob", back_populates="job_profile")

class Connector(Base):
    __tablename__ = "connectors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    platform_name = Column(String(100), nullable=False) # e.g. LinkedIn, Indeed
    credentials_json = Column(Text, nullable=True) # encrypted or raw JSON
    status = Column(String(50), nullable=False, default="Not Connected") # Connected, Not Connected, Error
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="connectors")

class AppliedJob(Base):
    __tablename__ = "applied_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_profile_id = Column(Integer, ForeignKey("job_profiles.id"), nullable=True)
    platform_name = Column(String(100), nullable=False) # e.g. LinkedIn, Indeed, Direct
    title = Column(String(150), nullable=False)
    company_name = Column(String(150), nullable=False)
    location = Column(String(150), nullable=True)
    salary = Column(String(100), nullable=True)
    job_url = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="applied") # applied, in-progress, first round, second round, offer letter received, rejected
    applied_date = Column(Date, default=datetime.date.today)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="applied_jobs")
    job_profile = relationship("JobProfile", back_populates="applied_jobs")
    cover_letter = relationship("CoverLetter", back_populates="applied_job", uselist=False, cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="applied_job", cascade="all, delete-orphan")

class CoverLetter(Base):
    __tablename__ = "cover_letters"

    id = Column(Integer, primary_key=True, index=True)
    applied_job_id = Column(Integer, ForeignKey("applied_jobs.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    applied_job = relationship("AppliedJob", back_populates="cover_letter")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    applied_job_id = Column(Integer, ForeignKey("applied_jobs.id"), nullable=False)
    sender = Column(String(50), nullable=False) # Recruiter, Candidate, AI Agent
    message_text = Column(Text, nullable=False)
    platform = Column(String(50), nullable=False, default="email") # email, sms, portal
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    applied_job = relationship("AppliedJob", back_populates="conversations")

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. Starter, Pro
    price = Column(Float, nullable=False)
    stripe_price_id = Column(String(100), nullable=True)
    features_json = Column(Text, nullable=False) # JSON list of features

    # Relationships
    order_items = relationship("OrderItem", back_populates="plan")

class Discount(Base):
    __tablename__ = "discounts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False) # e.g. FREETRIAL
    percentage = Column(Float, nullable=False) # 100.0 for free trial
    is_one_time = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)

    # Relationships
    orders = relationship("Order", back_populates="discount")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending") # pending, completed, cancelled
    total_amount = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    final_amount = Column(Float, nullable=False)
    discount_id = Column(Integer, ForeignKey("discounts.id"), nullable=True)
    stripe_session_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="orders")
    discount = relationship("Discount", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Float, nullable=False)

    # Relationships
    order = relationship("Order", back_populates="order_items")
    plan = relationship("Plan", back_populates="order_items")
