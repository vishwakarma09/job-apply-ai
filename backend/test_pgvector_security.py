import json
from app.database import SessionLocal
from app import models
from app.routes.connectors import sync_connector_security_questions
from app.services.embedding_service import get_embedding
from sqlalchemy import text

db = SessionLocal()

try:
    print("1. Finding or creating test connector for Job Bank...")
    user = db.query(models.User).filter(models.User.email == "kkumar.sandeep89@gmail.com").first()
    if not user:
        print("Test user not found!")
        exit(1)

    connector = db.query(models.Connector).filter(
        models.Connector.user_id == user.id,
        models.Connector.platform_name == "Job Bank"
    ).first()

    if not connector:
        connector = models.Connector(
            user_id=user.id,
            platform_name="Job Bank",
            status="Connected"
        )
        db.add(connector)
        db.commit()
        db.refresh(connector)

    # Set some credentials with security questions
    credentials = {
        "username": "sandeep_jobbank",
        "password": "securepassword123",
        "auth_method": "credentials",
        "security_questions": [
            {"question": "What was the name of your first pet?", "answer": "Buddy"},
            {"question": "In what city were you born?", "answer": "Toronto"},
            {"question": "What is your mother's maiden name?", "answer": "Smith"}
        ]
    }
    connector.credentials_json = json.dumps(credentials)
    db.commit()
    db.refresh(connector)

    print("2. Syncing security questions to connector_security_questions...")
    sync_connector_security_questions(db, connector)

    # Verify they were saved in the DB
    saved_qs = db.query(models.ConnectorSecurityQuestion).filter(
        models.ConnectorSecurityQuestion.connector_id == connector.id
    ).all()
    print(f"Saved {len(saved_qs)} questions in the database.")
    assert len(saved_qs) == 3
    for sq in saved_qs:
        print(f"  Q: '{sq.question}' -> A: '{sq.answer}' (Has embedding: {sq.question_embedding is not None})")
        assert sq.question_embedding is not None
        assert len(sq.question_embedding) == 1536

    print("\n3. Testing semantic matching via pgvector...")
    queries = [
        ("What was your first pet's name?", "Buddy", True),
        ("Where were you born?", "Toronto", True),
        ("What is your favorite color?", None, False)
    ]

    for q_text, expected_answer, should_match in queries:
        qv = get_embedding(q_text)
        qv_str = "[" + ",".join(map(str, qv)) + "]"

        stmt = text("""
            SELECT question, answer, 1 - (question_embedding <=> :qv) AS similarity
            FROM connector_security_questions
            WHERE connector_id = :connector_id AND TRIM(answer) != ''
            ORDER BY question_embedding <=> :qv
            LIMIT 1
        """)
        row = db.execute(stmt, {"qv": qv_str, "connector_id": connector.id}).fetchone()
        
        if row:
            sim = float(row.similarity)
            matched = sim >= 0.60
            print(f"Query: '{q_text}'")
            print(f"  Nearest Match: '{row.question}' -> '{row.answer}' (Similarity: {sim:.4f}, Matched: {matched})")
            if should_match:
                assert matched, f"Expected match for '{q_text}' but got similarity {sim}"
                assert row.answer == expected_answer, f"Expected answer '{expected_answer}' but got '{row.answer}'"
            else:
                assert not matched, f"Expected no match for '{q_text}' but matched with similarity {sim}"
        else:
            print(f"Query: '{q_text}' -> No rows found at all!")
            assert not should_match, f"Expected match for '{q_text}' but found no rows."

    print("\nAll tests passed successfully!")

finally:
    db.close()
