from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, profiles, connectors, jobs, billing, conversations, email_credentials

app = FastAPI(title="AI Job Apply API", version="1.0.0")

# Configure CORS so our React frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(connectors.router)
app.include_router(jobs.router)
app.include_router(billing.router)
app.include_router(conversations.router)
app.include_router(email_credentials.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to AI Job Apply Monolith API"
    }
