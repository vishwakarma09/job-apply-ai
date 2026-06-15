from app.database import SessionLocal
from app import models
from app.services.embedding_service import get_embedding
from app.routes.profiles import sync_profile_to_knowledgebase
from sqlalchemy import text

db = SessionLocal()

try:
    print("Testing local embedding generator...")
    v1 = get_embedding("Do you have experience with Ruby on Rails?")
    v2 = get_embedding("Are you experienced with Ruby on Rails?")
    v3 = get_embedding("What is your favorite color?")
    
    assert len(v1) == 1536
    assert len(v2) == 1536
    assert len(v3) == 1536
    print("Embedding generation verified successfully!")
    
    # Calculate cosine similarity manually: dot product since they are unit vectors
    sim_similar = sum(x*y for x, y in zip(v1, v2))
    sim_diff = sum(x*y for x, y in zip(v1, v3))
    
    print(f"Similarity (similar texts): {sim_similar:.4f}")
    print(f"Similarity (different texts): {sim_diff:.4f}")
    assert sim_similar > 0.5
    assert sim_similar > sim_diff
    
    # 2. Test RAG / Vector search in Postgres
    # Let's seed a test user and save answers
    user = db.query(models.User).filter(models.User.email == "kkumar.sandeep89@gmail.com").first()
    if not user:
        print("Test user not found, aborting DB test.")
        exit(0)
        
    print("\nAdding test question/answer to user_knowledgebase...")
    # Clean up old test data if any
    db.query(models.UserKnowledgebase).filter(
        models.UserKnowledgebase.user_id == user.id,
        models.UserKnowledgebase.question == "Do you have experience with Ruby on Rails?"
    ).delete()
    db.commit()
    
    # Add
    v_q = get_embedding("Do you have experience with Ruby on Rails?")
    kb_entry = models.UserKnowledgebase(
        user_id=user.id,
        question="Do you have experience with Ruby on Rails?",
        answer="Yes, 4 years of experience",
        question_embedding=v_q
    )
    db.add(kb_entry)
    db.commit()
    print("Test question/answer saved successfully!")
    
    # Semantic Search
    query = "Are you experienced with Ruby on Rails?"
    qv = get_embedding(query)
    qv_str = "[" + ",".join(map(str, qv)) + "]"
    
    stmt = text("""
        SELECT question, answer, 1 - (question_embedding <=> :qv) AS similarity
        FROM user_knowledgebase
        WHERE user_id = :user_id
        ORDER BY question_embedding <=> :qv
        LIMIT 1
    """)
    row = db.execute(stmt, {"qv": qv_str, "user_id": user.id}).fetchone()
    print(f"\nSemantic Query: '{query}'")
    print(f"Nearest Match: '{row.question}' -> '{row.answer}' (Similarity: {row.similarity:.4f})")
    assert row.similarity > 0.60
    assert row.answer == "Yes, 4 years of experience"
    print("RAG / Vector search verified successfully!")

except Exception as e:
    print(f"Error testing RAG: {e}")
    raise e
finally:
    db.close()
