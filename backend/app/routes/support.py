from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..config import settings
from ..services.cerebras_service import call_chat_completion
from typing import List

router = APIRouter(prefix="/api/support", tags=["Support & FAQ"])

def get_system_prompt(frontend_url: str) -> str:
    return f"""You are a helpful, professional, and friendly AI support assistant for the AI Job Apply platform.
Your goal is to answer app-specific questions accurately, clearly, and concisely, taking inspiration from e-commerce assistant bots.

Here is the essential documentation and instructions for the app:

1. HOW TO SETUP JOB CONNECTORS:
- Job connectors link your job board accounts (LinkedIn, Indeed, ZipRecruiter, VanHack, etc.) to the application.
- Setup steps:
  1. Open the "Connectors" page ({frontend_url}/connectors) from the sidebar.
  2. Select the connector type you wish to set up (e.g. LinkedIn, Indeed).
  3. Enter your email, password, and credentials in the form fields.
  4. Click the "Auto Login & Apply" button. This launches the automation flow via our Chrome browser extension to establish a session.
  5. Ensure you have the browser extension active so it can synchronize the login session.

2. HOW TO SETUP AI CONNECTORS:
- AI connectors tailor cover letters and solve complex job application screens.
- By default, the app uses our Cerebras Cloud high-speed engine (using a shared system key for gpt-oss-120b).
- To use your own keys (Cerebras or OpenAI):
  1. Navigate to the "Profile" page ({frontend_url}/profile).
  2. Scroll down to the "AI Connector Settings" section.
  3. Select your provider: Cerebras (using cloud.cerebras.ai keys) or OpenAI (using platform.openai.com keys).
  4. Paste your API key into the input field and click "Save AI Connector Settings".

3. FREQUENTLY ASKED QUESTIONS (FAQs):
- What is the Knowledge Graph?
  The Knowledge Graph is a section on your Profile page listing unresolved or unanswered questions found during applications. When the browser extension encounters a field it cannot fill, it marks the job as 'needs-knowledge-graph'. You can answer these questions directly on your Profile page to unblock the auto-applier.
- How does the Auto-Learning Pipeline work?
  When you manually fill out forms and click "Continue", our browser extension automatically learns your choices and saves them to your RAG knowledge base.
- How do I install the Chrome Browser Extension?
  Unzip the `job-apply-extension.zip` file or locate the `/browser-extension` folder. Go to chrome://extensions in your Google Chrome browser, enable "Developer mode" in the top-right corner, click "Load unpacked", and select the unzipped extension directory.
- Is there a Free Trial code?
  Yes! You can enter the promo code "FREETRIAL" during checkout on the Pricing page to unlock all Pro features instantly without a credit card.
- Is my data secure?
  Absolutely. All credentials and keys are encrypted and stored securely in our database. We never expose passwords in logs or scripts.

When answering, be friendly and use bullet points where helpful. If the user asks general coding questions or unrelated questions, gently redirect them to ask about AI Job Apply."""

@router.post("", response_model=schemas.SupportTicketResponse, status_code=201)
def create_support_ticket(ticket_in: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    ticket = models.SupportTicket(
        name=ticket_in.name,
        email=ticket_in.email,
        subject=ticket_in.subject,
        message=ticket_in.message
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.post("/chat", response_model=schemas.ChatResponse)
def support_chat(chat_in: schemas.ChatRequest):
    frontend_url = settings.EXTENSION_FRONTEND_URL.rstrip('/')
    system_prompt = get_system_prompt(frontend_url)
    
    # Construct messages array for LLM
    messages = [{"role": "system", "content": system_prompt}]
    
    # Append history if provided
    if chat_in.history:
        for msg in chat_in.history:
            messages.append({"role": msg.role, "content": msg.content})
            
    # Append current message
    messages.append({"role": "user", "content": chat_in.message})
    
    try:
        # call_chat_completion temperature = 0.5
        ai_response = call_chat_completion(messages, temperature=0.5)
        return schemas.ChatResponse(response=ai_response)
    except Exception as e:
        print(f"Chat completion failed: {e}. Using fallback rule-based response.")
        
        # Rule-based fallback
        query = chat_in.message.lower()
        if "job connector" in query or "setup job" in query or "connectors page" in query:
            resp = (
                "To set up Job Connectors:\n\n"
                f"1. Go to the **Connectors** page ({frontend_url}/connectors).\n"
                "2. Choose your platform (e.g. LinkedIn, Indeed, ZipRecruiter).\n"
                "3. Enter your login email and password.\n"
                "4. Click **'Auto Login & Apply'** to trigger the auto-login flow through our Chrome Extension.\n"
                "Make sure you have our browser extension installed and running to complete the synchronization."
            )
        elif "ai connector" in query or "setup ai" in query or "openai key" in query or "cerebras key" in query:
            resp = (
                "To set up AI Connectors (Cerebras or OpenAI):\n\n"
                f"1. Open your **Profile** page ({frontend_url}/profile).\n"
                "2. Scroll down to the **AI Connector Settings** section.\n"
                "3. Select your provider (Cerebras or OpenAI) and paste your API key.\n"
                "4. Click **'Save AI Connector Settings'** to store them.\n\n"
                "By default, the platform uses our high-speed Cerebras system engine if you do not configure custom keys."
            )
        elif "extension" in query or "install" in query or "chrome" in query or "zip" in query:
            resp = (
                "To install the Chrome Browser Extension:\n\n"
                "1. Locate or download `job-apply-extension.zip` or the `/browser-extension` folder.\n"
                "2. Unzip the file if it's zipped.\n"
                "3. Open Google Chrome and go to `chrome://extensions`.\n"
                "4. Enable **'Developer mode'** in the top-right corner.\n"
                "5. Click **'Load unpacked'** in the top-left and select the unzipped extension directory."
            )
        elif "free trial" in query or "freetrial" in query or "trial" in query or "promo" in query or "coupon" in query:
            resp = (
                "Yes, we offer a Free Trial! You can unlock all Pro features instantly "
                "by entering the promo code **FREETRIAL** on the checkout page under the Pricing section. "
                "No credit card is required."
            )
        elif "knowledge graph" in query or "graph" in query or "needs-knowledge-graph" in query or "gap" in query:
            resp = (
                "The **Knowledge Graph** on your Profile page manages unanswered application questions. "
                "When our browser extension detects form questions it can't resolve, it highlights them as 'gaps' "
                "and sets the job status to 'needs-knowledge-graph'. "
                f"Answering these questions on your profile page ({frontend_url}/profile) resolves the gaps and lets the auto-applier retry automatically."
            )
        else:
            resp = (
                "I am here to help you get the most out of AI Job Apply! "
                "Here are some common topics you can ask me about:\n\n"
                "- **How to setup Job Connectors** (LinkedIn, Indeed, ZipRecruiter)\n"
                "- **How to setup AI Connectors** (Cerebras or OpenAI keys)\n"
                "- **How to install the Chrome Extension**\n"
                "- **What the Knowledge Graph is** and how to resolve application gaps\n"
                "- **Free Trial access** using the code **FREETRIAL**\n\n"
                "Feel free to ask any specific questions!"
            )
        return schemas.ChatResponse(response=resp)

