# AI Job Apply - Monolith Application

AI Job Apply is a fully dockerized monorepo application designed to automate the job search and application process. It parses candidate resumes, tailors custom cover letters using Cerebras LLM completions, manages connected job boards (LinkedIn, Indeed, ZipRecruiter), and tracks all applied positions on an interactive Kanban board.

---

## Architecture & Technology Stack

The project follows a monolith structure separated into decoupled frontend and backend services:

### 1. Backend (`/backend`)
- **FastAPI**: Main API framework with automatic OpenAPI documentation.
- **SQLAlchemy 2.0+ & Alembic**: Database ORM and migrations.
- **PostgreSQL 15**: Primary relational database.
- **Redis**: Caching and background job coordination.
- **Cerebras Cloud Completions**: Llama 3.1-8B inference integration to generate customized cover letters based on specific resume texts and target job descriptions.
- **Google SSO**: Integrated token authentication.
- **Stripe & Free Trial Bypass**: Direct `Plan`, `Order`, `OrderItem`, and `Discount` database tracking. Supports the direct free-trial promocode `FREETRIAL` to unlock Pro privileges instantly without reaching external payment gateways.
- **PyPDF**: Parse text from uploaded PDF resumes.

### 2. Frontend (`/frontend`)
- **Vite + React 19**: Standard high-performance React runtime.
- **Tailwind CSS v4**: Utility-first styling with Obsidian Glassmorphism theme.
- **Axios**: Configured client with automatic JWT header injection and automatic login/logout session handling.
- **React Router Dom v7**: Global routing configuration.

---

## Local Development Setup

Follow these steps to set up and run the application locally on your machine.

### Prerequisites
Make sure you have the following installed:
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
- [Python 3.10+](https://www.python.org/downloads/) (Optional: only needed if running tests locally outside Docker)

### 1. Build and Start the Services
Navigate to the infrastructure directory and spin up the Docker containers:
```bash
cd infra
docker compose up -d --build
```
This builds and boots up the following containers:
- **Frontend** dev server on `http://localhost:5173`
- **Backend** FastAPI on `http://localhost:8000`
- **PostgreSQL** Database on host port `5432`
- **Redis** Cache on host port `6379`
- **Mailpit** SMTP server (webmail sandbox on `http://localhost:18025`)

### 2. Populate the Database (Seeding)
Seed the fresh database with initial plans, promocodes, mock candidates, resumes, and conversation logs:
```bash
docker compose exec backend python seed.py
```
*Note: This creates a test user `test@aijobapply.com` with the password `Password@123`.*

### 3. Verify the Installation (Integration Tests)
Run the automated integration test suite to verify the authentication, profile uploads, cover letter tailoring, and free-trial billing bypass logic:
```bash
python3 backend/test_endpoints.py
```

---

## Access Points Reference

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend App** | [http://localhost:5173](http://localhost:5173) | User landing page, Kanban board, profiles |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | Root API endpoint |
| **Swagger API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **Mailpit Inbox** | [http://localhost:18025](http://localhost:18025) | Outgoing email sandbox viewer |

---

## Directory Structure

```text
├── backend/            # FastAPI source, migrations, and integration tests
├── docs/               # Architecture diagrams and raw Stitch HTML templates
├── frontend/           # React 19 source, assets, and styling components
├── infra/              # docker-compose.yml configuration
└── scripts/            # Automation utility scripts
```
