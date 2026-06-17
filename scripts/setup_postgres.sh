#!/bin/bash
set -e

# Get the directory of the script and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Determine which env file to load
ENV_FILE=""
if [ -f "$BACKEND_DIR/.env.production" ]; then
    ENV_FILE="$BACKEND_DIR/.env.production"
elif [ -f "$BACKEND_DIR/.env" ]; then
    ENV_FILE="$BACKEND_DIR/.env"
fi

if [ -n "$ENV_FILE" ]; then
    echo "Loading environment configuration from $(basename "$ENV_FILE")..."
    # Load variables from env file
    set -a
    source "$ENV_FILE"
    set +a
else
    echo "Warning: No environment file found at backend/.env or backend/.env.production."
fi

# Parse DATABASE_URL if present to get user, password, and db name
if [ -n "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^/]+)/([^?]+) ]]; then
        DB_USER="${DB_USER:-${BASH_REMATCH[2]}}"
        DB_PASS="${DB_PASS:-${BASH_REMATCH[3]}}"
        DB_NAME="${DB_NAME:-${BASH_REMATCH[5]}}"
    fi
fi

# Fallbacks to other common env variable names
DB_USER="${DB_USER:-$POSTGRES_USER}"
DB_PASS="${DB_PASS:-$DB_PASSWORD}"
DB_PASS="${DB_PASS:-$POSTGRES_PASSWORD}"
DB_NAME="${DB_NAME:-$POSTGRES_DB}"

# Prompt for values if still missing
if [ -z "$DB_USER" ]; then
    read -p "Enter PostgreSQL username [jobapplyai_user]: " DB_USER
    DB_USER=${DB_USER:-jobapplyai_user}
fi

if [ -z "$DB_PASS" ]; then
    read -sp "Enter PostgreSQL password: " DB_PASS
    echo ""
fi

if [ -z "$DB_NAME" ]; then
    read -p "Enter PostgreSQL database name [jobapplyai_db]: " DB_NAME
    DB_NAME=${DB_NAME:-jobapplyai_db}
fi

echo "=== Installing PostgreSQL pgvector extension ==="
sudo apt-get update
sudo apt-get install -y postgresql-16-pgvector

echo "=== Creating PostgreSQL Database and User ==="
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" || echo "Database ${DB_NAME} already exists"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" || echo "User ${DB_USER} already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "=== Enabling pgvector extension and granting schema access on ${DB_NAME} ==="
sudo -u postgres psql -d ${DB_NAME} -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

echo "=== Database Setup Complete! ==="
