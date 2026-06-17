#!/bin/bash
set -e

echo "=== Installing PostgreSQL pgvector extension ==="
sudo apt-get update
sudo apt-get install -y postgresql-16-pgvector

echo "=== Creating PostgreSQL Database and User ==="
sudo -u postgres psql -c "CREATE DATABASE jobapplyai_db;" || echo "Database jobapplyai_db already exists"
sudo -u postgres psql -c "CREATE USER jobapplyai_user WITH PASSWORD '$DB_PASS';" || echo "User jobapplyai_user already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE jobapplyai_db TO jobapplyai_user;"

echo "=== Enabling pgvector extension and granting schema access on jobapplyai_db ==="
sudo -u postgres psql -d jobapplyai_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d jobapplyai_db -c "GRANT ALL ON SCHEMA public TO jobapplyai_user;"

echo "=== Database Setup Complete! ==="
