import datetime
import json
from app.database import SessionLocal, engine, Base
from app.auth import get_password_hash
from app import models

# Ensure tables are created
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("Seeding database...")
    
    # 1. Clear existing data to avoid duplicates
    db.query(models.Conversation).delete()
    db.query(models.CoverLetter).delete()
    db.query(models.AppliedJob).delete()
    db.query(models.Connector).delete()
    db.query(models.JobProfile).delete()
    db.query(models.Resume).delete()
    db.query(models.OrderItem).delete()
    db.query(models.Order).delete()
    db.query(models.Plan).delete()
    db.query(models.Discount).delete()
    db.query(models.UserKnowledgebase).delete()
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
        role="admin"
    )
    test_user = models.User(
        name="Sandeep Kumar",
        email="kkumar.sandeep89@gmail.com",
        hashed_password=get_password_hash("password"),
        role="user"
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
        resume_id=resume.id
    )
    profile2 = models.JobProfile(
        user_id=test_user.id,
        title="Full Stack Developer",
        is_active=False,
        resume_id=resume.id
    )
    db.add(profile1)
    db.add(profile2)
    db.flush()
    
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
    db.add(connector1)
    db.add(connector2)
    db.add(connector3)
    db.add(connector4)
    db.add(connector5)
    db.add(connector6)
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
    
    db.commit()
    print("Database seeding completed successfully.")
except Exception as e:
    db.rollback()
    print(f"Error seeding database: {e}")
finally:
    db.close()
