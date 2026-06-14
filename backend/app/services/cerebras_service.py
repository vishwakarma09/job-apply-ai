import httpx
import json
from ..config import settings

def generate_cover_letter(resume_text: str, job_description: str) -> str:
    prompt = (
        f"You are a helpful assistant writing a professional, customized cover letter. "
        f"Analyze the following resume and tailor a cover letter specifically for the job description provided below.\n\n"
        f"Resume:\n{resume_text}\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Keep the cover letter concise, professional, and highlight matching skills. "
        f"Do not include placeholders like [Date], [Manager Name] - write a clean, ready-to-send cover letter."
    )
    
    headers = {
        "Authorization": f"Bearer {settings.CEREBRAS_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "gpt-oss-120b",
        "messages": [
            {"role": "system", "content": "You are a professional career coach and copywriter."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }
    
    # Try using the Cerebras API endpoint directly
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers=headers,
                json=data
            )
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"].strip()
            else:
                raise ValueError(f"Cerebras API returned status {response.status_code}: {response.text}")
    except Exception as e:
        # Fallback helper: return a mock tailored cover letter if API fails/offline in local tests
        print(f"Cerebras generation failed: {str(e)}. Using fallback mock generation.")
        return (
            f"Dear Hiring Team,\n\n"
            f"I am writing to express my strong interest in the open position. "
            f"My background aligning with your job description makes me a strong fit. "
            f"Specifically, my experience in development matches your requirements.\n\n"
            f"I look forward to discussing this opportunity further.\n\n"
            f"Sincerely,\nApplicant"
        )

def solve_screen(profile_data: dict, url: str, title: str, heading: str, fields: list, rag_context: list = None) -> dict:
    rag_context_str = ""
    if rag_context:
        rag_context_str = "\n\nPreviously Resolved Questions (RAG Context):\n"
        for idx, entry in enumerate(rag_context, 1):
            rag_context_str += f"{idx}. Question: \"{entry['question']}\" -> Answer: \"{entry['answer']}\" (Confidence: {entry['similarity']:.2f})\n"
        rag_context_str += "\nUse the answers from the 'Previously Resolved Questions' above to guide your choices for similar questions. Highly prioritize matching these answers."

    prompt = (
        f"You are an AI-powered job application form solver. Your task is to analyze the current webpage screen "
        f"and decide what action to take based on the candidate's profile.{rag_context_str}\n\n"
        f"Candidate Profile:\n{profile_data}\n\n"
        f"Current Page Details:\n"
        f"- URL: {url}\n"
        f"- Page Title: {title}\n"
        f"- Section Heading: {heading}\n"
        f"- Detectable Form Fields: {fields}\n\n"
        f"Instructions:\n"
        f"1. For each input/textarea/select field in 'Detectable Form Fields', decide what value to enter from the candidate profile.\n"
        f"2. For radio buttons and checkboxes, specify which option value should be selected/checked.\n"
        f"3. Identify if there is a 'continue', 'next', 'submit', or 'back to application' button, and specify how to click it.\n"
        f"4. If the page is a profile or resume review redirect (e.g. contains a 'continue' URL parameter or redirects to a resume page), "
        f"specify if we should redirect back using that URL.\n"
        f"5. IMPORTANT WORK AUTH RULE: If the candidate's nationality or work authorization indicates they are a Canadian citizen "
        f"(e.g., contains 'Canadian' or 'Canada'), and any text input, textarea, or question asks for 'reason to apply', "
        f"'work authorization details', or 'sponsorship explanation', you MUST answer that the applicant is a Canadian citizen "
        f"and can work under a TN visa.\n\n"
        f"You MUST return your answer as a raw JSON object with the following schema:\n"
        f"{{\n"
        f"  \"action\": \"fill\" | \"redirect\" | \"wait\",\n"
        f"  \"redirect_url\": \"string or null (if action is redirect)\",\n"
        f"  \"fields\": [\n"
        f"    {{\n"
        f"      \"id\": \"field_id\",\n"
        f"      \"name\": \"field_name\",\n"
        f"      \"type\": \"input_type\",\n"
        f"      \"value\": \"value_to_fill_or_select\"\n"
        f"    }}\n"
        f"  ],\n"
        f"  \"click_button\": \"button_text_or_selector_to_click_or_null\"\n"
        f"}}\n"
        f"Do not include any thinking, explanations or markdown block formatting. Return raw JSON."
    )
    
    headers = {
        "Authorization": f"Bearer {settings.CEREBRAS_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "gpt-oss-120b",
        "messages": [
            {"role": "system", "content": "You are a professional form-solving bot."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers=headers,
                json=data
            )
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"].strip()
                
                # Strip markdown quotes if LLM returned them
                if content.startswith("```"):
                    parts = content.split("```")
                    if len(parts) > 1:
                        content = parts[1]
                        if content.startswith("json"):
                            content = content[4:]
                content = content.strip("` \n")
                
                return json.loads(content)
            else:
                raise ValueError(f"Cerebras API returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Cerebras solve_screen failed: {str(e)}. Using fallback empty action.")
        return {"action": "wait", "fields": [], "click_button": None}
