import datetime
import json
from app.database import SessionLocal, engine, Base
from app.auth import get_password_hash
from app import models
from app.services.embedding_service import get_embedding
from app.routes.profiles import sync_profile_to_knowledgebase

# Ensure tables are created
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("Seeding database...")
    
    # 1. Clear existing data to avoid duplicates
    db.query(models.Conversation).delete()
    db.query(models.CoverLetter).delete()
    db.query(models.AppliedJob).delete()
    db.query(models.ConnectorSecurityQuestion).delete()
    db.query(models.Connector).delete()
    db.query(models.JobProfile).delete()
    db.query(models.Resume).delete()
    db.query(models.OrderItem).delete()
    db.query(models.Order).delete()
    db.query(models.Plan).delete()
    db.query(models.Discount).delete()
    db.query(models.UserKnowledgebase).delete()
    db.query(models.EmailCredential).delete()
    db.query(models.SupportTicket).delete()
    db.query(models.User).delete()
    db.commit()

    # 2. Seed Plans
    plans_data = [
        {
            "name": "Starter",
            "price": 9.0,
            "stripe_price_id": "price_starter_9",
            "features_json": json.dumps(["5 applications/day", "Basic cover letter tailoring", "Platform connectors"])
        },
        {
            "name": "Pro",
            "price": 29.0,
            "stripe_price_id": "price_pro_29",
            "features_json": json.dumps(["Unlimited applications", "Full resume parsing", "Google SSO & Stripe checkout", "24/7 AI Job Hunting", "Smart Kanban tracker", "Priority Support"])
        }
    ]
    
    plans = {}
    for pd in plans_data:
        plan = models.Plan(
            name=pd["name"],
            price=pd["price"],
            stripe_price_id=pd["stripe_price_id"],
            features_json=pd["features_json"]
        )
        db.add(plan)
        db.flush()
        plans[pd["name"]] = plan
        
    # 3. Seed Discounts
    freetrial_discount = models.Discount(
        code="FREETRIAL",
        percentage=100.0,
        is_one_time=True,
        is_active=True
    )
    db.add(freetrial_discount)
    db.flush()
    
    # 4. Seed Users
    admin_user = models.User(
        name="Admin User",
        email="admin@aijobapply.com",
        hashed_password=get_password_hash("Password@123"),
        role="admin",
        is_active=True
    )
    test_user = models.User(
        name="Sandeep Kumar",
        email="kkumar.sandeep89@gmail.com",
        hashed_password=get_password_hash("password"),
        role="user",
        is_active=True
    )
    db.add(admin_user)
    db.add(test_user)
    db.flush()
    
    # 5. Seed Resume & Job Profiles
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    resume_path = os.path.join(script_dir, "..", "docs", "Sandeep_Kumar_Resume.txt")
    if os.path.exists(resume_path):
        with open(resume_path, "r", encoding="utf-8") as f:
            resume_text = f.read()
    else:
        resume_text = (
            "Sandeep Kumar\n"
            "Full Stack Developer | Toronto, Ontario, Canada | 647-395-0215 | kkumar.sandeep89@gmail.com\n\n"
            "Professional Summary\n"
            "Highly experienced Senior Full Stack Developer specializing in architecting and deploying scalable "
            "Generative AI (GenAI) solutions and microservices. Proven expertise in modern technologies including "
            "Python (FastAPI, Flask), Node.js (Nest.js), and Go, coupled with a deep understanding of full-stack development "
            "(React.js, Vue.js)."
        )

    resume = models.Resume(
        user_id=test_user.id,
        filename="Sandeep_Kumar_Resume.txt",
        file_path="docs/Sandeep_Kumar_Resume.txt",
        extracted_text=resume_text
    )
    db.add(resume)
    db.flush()
    
    profile1 = models.JobProfile(
        user_id=test_user.id,
        title="Senior Full Stack Developer",
        is_active=True,
        resume_id=resume.id,
        phone="647-395-0215",
        email="kkumar.sandeep89@gmail.com",
        city="Toronto",
        nationality="Canadian Citizen",
        work_authorization="Authorized to work in Canada and India. Eligible for TN Visa for USA.",
        visa_sponsorship="Requires TN Visa support for USA. No sponsorship needed for Canada or India."
    )
    profile2 = models.JobProfile(
        user_id=test_user.id,
        title="Full Stack Developer",
        is_active=False,
        resume_id=resume.id,
        phone="647-395-0215",
        email="kkumar.sandeep89@gmail.com",
        city="Toronto",
        nationality="Canadian Citizen",
        work_authorization="Authorized to work in Canada and India. Eligible for TN Visa for USA.",
        visa_sponsorship="Requires TN Visa support for USA. No sponsorship needed for Canada or India."
    )
    db.add(profile1)
    db.add(profile2)
    db.flush()
    
    # Sync profiles to knowledge base to automatically generate vector DB records
    sync_profile_to_knowledgebase(db, profile1)
    
    # 6. Seed Connectors
    connector1 = models.Connector(
        user_id=test_user.id,
        platform_name="LinkedIn",
        credentials_json=json.dumps({"session_id": "mock_cookie_123"}),
        status="Connected",
        last_sync_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    )
    connector2 = models.Connector(
        user_id=test_user.id,
        platform_name="Indeed",
        credentials_json=json.dumps({"session_id": "mock_cookie_456"}),
        status="Connected",
        last_sync_at=datetime.datetime.utcnow() - datetime.timedelta(hours=5)
    )
    connector3 = models.Connector(
        user_id=test_user.id,
        platform_name="ZipRecruiter",
        credentials_json=None,
        status="Not Connected"
    )
    connector4 = models.Connector(
        user_id=test_user.id,
        platform_name="Greenhouse",
        credentials_json=None,
        status="Not Connected"
    )
    connector5 = models.Connector(
        user_id=test_user.id,
        platform_name="Glassdoor",
        credentials_json=None,
        status="Not Connected"
    )
    connector6 = models.Connector(
        user_id=test_user.id,
        platform_name="Randstad",
        credentials_json=None,
        status="Not Connected"
    )
    connector7 = models.Connector(
        user_id=test_user.id,
        platform_name="Job Bank",
        credentials_json=None,
        status="Not Connected"
    )
    connector8 = models.Connector(
        user_id=test_user.id,
        platform_name="CareerBeacon",
        credentials_json=None,
        status="Not Connected"
    )
    connector9 = models.Connector(
        user_id=test_user.id,
        platform_name="VanHack",
        credentials_json=None,
        status="Not Connected"
    )
    db.add(connector1)
    db.add(connector2)
    db.add(connector3)
    db.add(connector4)
    db.add(connector5)
    db.add(connector6)
    db.add(connector7)
    db.add(connector8)
    db.add(connector9)
    db.flush()
    
    # 7. Seed Applied Jobs & Conversations
    job1 = models.AppliedJob(
        user_id=test_user.id,
        job_profile_id=profile1.id,
        platform_name="LinkedIn",
        title="Senior Product Designer",
        company_name="Google",
        location="Mountain View, CA",
        salary="$150k - $180k",
        job_url="https://google.com/jobs/designer",
        status="first round",
        applied_date=datetime.date.today() - datetime.timedelta(days=10)
    )
    db.add(job1)
    db.flush()
    
    cover_letter1 = models.CoverLetter(
        applied_job_id=job1.id,
        content=(
            "Dear Hiring Manager,\n\n"
            "I am writing to express my enthusiastic interest in the Senior Product Designer position at Google. "
            "My experience in engineering combined with a user-centric design philosophy positions me well for this role. "
            "I look forward to contributing to Google's innovative product ecosystem.\n\n"
            "Sincerely,\nJohn Doe"
        )
    )
    db.add(cover_letter1)
    
    convo1 = models.Conversation(
        applied_job_id=job1.id,
        sender="Recruiter",
        message_text="Hi John, thanks for applying. We'd love to schedule a first round interview.",
        platform="email",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    convo2 = models.Conversation(
        applied_job_id=job1.id,
        sender="Candidate",
        message_text="Hi Sarah, that sounds great! I'm available this Thursday at 2 PM.",
        platform="email",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    db.add(convo1)
    db.add(convo2)
    
    job2 = models.AppliedJob(
        user_id=test_user.id,
        job_profile_id=profile1.id,
        platform_name="Indeed",
        title="Full Stack Developer",
        company_name="TechCorp",
        location="Remote",
        salary="$120k - $140k",
        job_url="https://techcorp.com/careers",
        status="applied",
        applied_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    db.add(job2)
    
    job3 = models.AppliedJob(
        user_id=test_user.id,
        job_profile_id=profile1.id,
        platform_name="Direct",
        title="Senior Python Engineer",
        company_name="InnovateAI",
        location="New York, NY",
        salary="$160k - $190k",
        job_url="https://innovate.ai/jobs",
        status="in-progress",
        applied_date=datetime.date.today() - datetime.timedelta(days=4)
    )
    db.add(job3)
    
    # 8. Seed User Knowledgebase (Vector Database)
    knowledgebase_questions = [
        # Job preference questions
        {
            "question": "Job preference",
            "answer": "Full-time"
        },
        {
            "question": "Are you looking for full-time or part-time work?",
            "answer": "Full-time"
        },
        {
            "question": "What is your desired employment type?",
            "answer": "Full-time"
        },
        {
            "question": "What is your job preference?",
            "answer": "Full-time"
        },
        {
            "question": "Preferred job type",
            "answer": "Full-time"
        },
        # Location questions
        {
            "question": "Location",
            "answer": "Toronto, Ontario, Canada"
        },
        {
            "question": "Where are you located?",
            "answer": "Toronto, Ontario, Canada"
        },
        {
            "question": "What is your current location?",
            "answer": "Toronto, Ontario, Canada"
        },
        {
            "question": "Desired job location",
            "answer": "Toronto"
        },
        {
            "question": "Street Address",
            "answer": "123 Yonge Street"
        },
        {
            "question": "Address",
            "answer": "123 Yonge Street"
        },
        {
            "question": "City",
            "answer": "Toronto"
        },
        {
            "question": "State/Province",
            "answer": "Ontario"
        },
        {
            "question": "Postal/ZIP",
            "answer": "M2J 4Y8"
        },
        {
            "question": "Zip Code",
            "answer": "M2J 4Y8"
        },
        {
            "question": "Desired Pay",
            "answer": "120000"
        },
        {
            "question": "Desired salary",
            "answer": "120000"
        },
        # Work authorization questions
        {
            "question": "Work authorization status",
            "answer": "Authorized to work in Canada and India."
        },
        {
            "question": "In which countries are you authorized to work?",
            "answer": "Authorized to work in Canada and India."
        },
        {
            "question": "Are you legally authorized to work in Canada?",
            "answer": "Yes, I am authorized to work in Canada."
        },
        {
            "question": "Are you legally authorized to work in India?",
            "answer": "Yes, I am authorized to work in India."
        },
        # USA work and TN Visa questions
        {
            "question": "Do you require sponsorship to work in the USA?",
            "answer": "I require sponsorship/TN visa support to work in the USA, but I am eligible for a TN Visa."
        },
        {
            "question": "Are you authorized to work in the USA?",
            "answer": "I require a TN Visa to work in the USA, which I am eligible for as a Canadian citizen."
        },
        {
            "question": "Do you need a TN Visa for USA work?",
            "answer": "Yes, I require a TN Visa to work in the USA."
        },
        {
            "question": "What is your USA work authorization status?",
            "answer": "I require a TN Visa to work in the USA."
        },
        {
            "question": "Will you now or in the future require visa sponsorship to work in the US?",
            "answer": "Yes, I require support for a TN Visa to work in the USA."
        },
        {
            "question": "Eligible for TN Visa",
            "answer": "Yes, I am eligible for a TN Visa to work in the USA."
        }
    ]

    for kb_data in knowledgebase_questions:
        # Check if it already exists to prevent duplicate seeding
        existing_kb = db.query(models.UserKnowledgebase).filter(
            models.UserKnowledgebase.user_id == test_user.id,
            models.UserKnowledgebase.question == kb_data["question"]
        ).first()
        
        embedding = get_embedding(kb_data["question"])
        
        if existing_kb:
            existing_kb.answer = kb_data["answer"]
            existing_kb.question_embedding = embedding
        else:
            new_kb = models.UserKnowledgebase(
                user_id=test_user.id,
                question=kb_data["question"],
                answer=kb_data["answer"],
                question_embedding=embedding
            )
            db.add(new_kb)
            
    db.commit()
    print("Database seeding completed successfully.")
except Exception as e:
    db.rollback()
    print(f"Error seeding database: {e}")
finally:
    db.close()
