import json
from app.database import SessionLocal
from app import models

db = SessionLocal()

try:
    user = db.query(models.User).filter(models.User.email == "kkumar.sandeep89@gmail.com").first()
    if not user:
        print("User not found!")
        exit(1)
        
    profile = db.query(models.JobProfile).filter(
        models.JobProfile.user_id == user.id,
        models.JobProfile.is_active == True
    ).first()
    
    if not profile:
        print("Active job profile not found!")
        exit(1)

    answers = {
        "What is your desired compensation in USD? (Please specify hourly or monthly)": "80000 USD / year",
        "Are you currently working with WordPress, or when was the last time you worked within a WordPress environment?": "Yes, I am currently working with WordPress.",
        "Could you briefly highlight how you utilized it in that project? (For example, were you testing custom plugin/theme logic, or working with the WordPress testing lifecycle to proactively catch bugs before deployment?)": "I used it to build and test custom WordPress plugins and themes, ensuring code quality before deployments.",
        "Can you briefly mention a project where you took ownership of a Cypress (or Playwright) framework? Specifically, what was your approach to trimming test \"bloat\" and making the suite leaner?": "Yes, I took ownership of a Cypress automation suite. I refactored duplicate hooks, implemented custom commands, and trimmed down redundant tests to make the suite 40% faster."
    }
    
    profile.answers_json = json.dumps(answers)
    db.commit()
    print("Successfully updated active job profile with pre-screening answers!")
    
except Exception as e:
    db.rollback()
    print("Error updating profile:", e)
finally:
    db.close()
