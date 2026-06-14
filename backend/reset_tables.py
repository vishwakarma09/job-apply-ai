# reset_tables.py
# Drops all database tables to force SQLAlchemy to re-create them with the new columns

import sys
from app.database import engine, Base
from app import models

print("Dropping all database tables...")
Base.metadata.drop_all(bind=engine)
print("All tables dropped successfully!")
