# AI Job Apply - Monolith Application

AI Job Apply is a fully dockerized monorepo application designed to automate the job search and application process. It parses candidate resumes, tailors custom cover letters using Cerebras LLM completions, manages connected job boards (LinkedIn, Indeed, ZipRecruiter), and tracks all applied positions on an interactive Kanban board.

---

## Architecture & Technology Stack

The project follows a monolith structure separated into decoupled frontend and backend services:

### 1. Backend (`/backend`)
- **FastAPI**: Main API framework with automatic OpenAPI documentation.
- **SQLAlchemy 2.0+ & Alembic**: Database ORM and migrations.
- **PostgreSQL 15 & pgvector**: Relational database with vector search capabilities enabled via the `vector` extension.
- **Semantic RAG Memory Cache (`user_knowledgebase`)**: Performs semantic cosine-similarity query (`<=>`) to retrieve relevant previously answered questions/profile fields and injects them as context (RAG) into LLM prompts.
- **Deterministic Embeddings Service**: Custom, lightweight token-hashing algorithm generating 1536-dimensional unit vectors deterministically (zero external API/model dependencies).
- **Auto-Learning Pipeline**: Automatically vectorizes and stores newly resolved or manually answered questions into the RAG vector database, with overwrite protection preventing empty strings (`""`) from erasing correct answers.
- **RAG Gap API**: Dedicated REST endpoints (`GET /api/profiles/knowledgebase`, `GET /api/profiles/knowledgebase/unanswered`, `PUT /api/profiles/knowledgebase/{kb_id}`) to expose, retrieve, and update user knowledge base questions.
- **Cerebras Cloud Completions**: `gpt-oss-120b` high-speed inference integration to solve complex application screens and generate customized cover letters based on candidate resumes and job descriptions.
- **TN Visa Logic**: Custom RAG completions logic for Canadian citizens to automatically answer "reason to apply" and "sponsorship status" questions stating eligibility under the TN visa.
- **Redis**: Caching and background job coordination.
- **Google SSO**: Integrated token authentication.
- **Stripe & Free Trial Bypass**: Direct `Plan`, `Order`, `OrderItem`, and `Discount` database tracking. Supports the direct free-trial promocode `FREETRIAL` to unlock Pro privileges instantly without reaching external payment gateways.
- **PyPDF**: Parse text from uploaded PDF resumes.

### 2. Frontend (`/frontend`)
- **Vite + React 19**: Standard high-performance React runtime.
- **Tailwind CSS v4**: Utility-first styling with Obsidian Glassmorphism theme.
- **Axios**: Configured client with automatic JWT header injection and automatic login/logout session handling.
- **React Router Dom v7**: Global routing configuration.
- **Knowledge Graph UI**: A dedicated subcomponent (`KnowledgeGraphQuestions`) rendered on the profile page that highlights unanswered questions and allows updating/managing vector database entries directly.

### 3. Chrome Extension (`/browser-extension`)
- **Multi-Tab Session Sync**: Handles automatic cross-tab synchronization (parent search tab initiates and monitors, child smartapply tab executes the auto-fill).
- **DOM Form Automator**: Fills text inputs, resolves dropdowns, checks required checkboxes, and matches correct radio button options.
- **Dynamic AI Solver**: Resolves required fields using a local heuristics fallback and calls the Cerebras-powered AI Solver (`POST /api/solve-screen`).
- **Unresolved Field Highlighting**: Identifies unresolved required fields, applies red highlights to elements/fieldset legends, and scrolls them smoothly into view.
- **Auto-Learning Trigger**: Collects page answers on Continue clicks and sends them to `/api/profiles/active/learn` to train the RAG database.
- **Turbo Mode Gap Warning**: Polls for unanswered questions and renders a warning banner (`#kb-warning-alert`) blocking Turbo Apply execution if gaps are detected in the RAG profile.
- **Skip & Retry (Needs Knowledge Graph)**: Detects page stalls, unresolved form inputs, or disabled buttons, marking the job status as `'needs-knowledge-graph'` in the database. Automatically polls and retries these jobs once outstanding gaps are resolved.
- **Robust Stall Detection**: Uses a multi-iteration check (up to 6 checks / ~9 seconds of unchanged HTML) to prevent premature timeouts on slow-loading forms.


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
*Note: This creates a test user `kkumar.sandeep89@gmail.com` with the password `password`.*

### 3. Verify the Installation (Integration Tests)
Run the automated integration test suite to verify the authentication, profile uploads, cover letter tailoring, and free-trial billing bypass logic:
```bash
python3 backend/test_endpoints.py
```

### 4. Packaging the Browser Extension
To package the browser extension into a clean, lightweight ZIP file ready for uploading to the Chrome Web Store (excluding local cache, temporary browser profiles, and playwright captures), run:
```bash
./scripts/pack_extension.sh
```
This creates `job-apply-extension.zip` at the root of the project directory.

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
├── browser-extension/  # Chrome extension for easy apply automation
├── docs/               # Architecture diagrams and raw Stitch HTML templates
├── frontend/           # React 19 source, assets, and styling components
├── infra/              # docker-compose.yml configuration
└── scripts/            # Automation utility scripts
```
