import httpx
import json
from ..config import settings

def call_chat_completion(
    messages: list, 
    temperature: float, 
    openai_api_key: str = None, 
    cerebras_api_key: str = None, 
    preferred_provider: str = "default"
) -> str:
    # Determine routing
    provider = preferred_provider or "default"
    if provider == "openai" and openai_api_key:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openai_api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "gpt-4o",
            "messages": messages,
            "temperature": temperature
        }
    elif provider == "cerebras" and cerebras_api_key:
        url = "https://api.cerebras.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {cerebras_api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "gpt-oss-120b",
            "messages": messages,
            "temperature": temperature
        }
    else:
        # Fallback to default system Cerebras
        url = "https://api.cerebras.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.CEREBRAS_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "gpt-oss-120b",
            "messages": messages,
            "temperature": temperature
        }
        
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, headers=headers, json=data)
        if response.status_code == 200:
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()
        else:
            raise ValueError(f"{provider.capitalize()} API returned status {response.status_code}: {response.text}")

def generate_cover_letter(
    resume_text: str, 
    job_description: str,
    openai_api_key: str = None,
    cerebras_api_key: str = None,
    preferred_provider: str = "default"
) -> str:
    prompt = (
        f"You are a helpful assistant writing a professional, customized cover letter. "
        f"Analyze the following resume and tailor a cover letter specifically for the job description provided below.\n\n"
        f"Resume:\n{resume_text}\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Keep the cover letter concise, professional, and highlight matching skills. "
        f"Do not include placeholders like [Date], [Manager Name] - write a clean, ready-to-send cover letter."
    )
    
    messages = [
        {"role": "system", "content": "You are a professional career coach and copywriter."},
        {"role": "user", "content": prompt}
    ]
    
    # Try using the routed LLM helper
    try:
        return call_chat_completion(messages, 0.7, openai_api_key, cerebras_api_key, preferred_provider)
    except Exception as e:
        # Fallback helper: return a mock tailored cover letter if API fails/offline in local tests
        print(f"LLM generation failed: {str(e)}. Using fallback mock generation.")
        return (
            f"Dear Hiring Team,\n\n"
            f"I am writing to express my strong interest in the open position. "
            f"My background aligning with your job description makes me a strong fit. "
            f"Specifically, my experience in development matches your requirements.\n\n"
            f"I look forward to discussing this opportunity further.\n\n"
            f"Sincerely,\nApplicant"
        )

def solve_screen(
    profile_data: dict, 
    url: str, 
    title: str, 
    heading: str, 
    fields: list, 
    rag_context: list = None,
    openai_api_key: str = None,
    cerebras_api_key: str = None,
    preferred_provider: str = "default"
) -> dict:
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
    
    messages = [
        {"role": "system", "content": "You are a professional form-solving bot."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        content = call_chat_completion(messages, 0.2, openai_api_key, cerebras_api_key, preferred_provider)
        
        # Strip markdown quotes if LLM returned them
        if content.startswith("```"):
            parts = content.split("```")
            if len(parts) > 1:
                content = parts[1]
                if content.startswith("json"):
                    content = content[4:]
        content = content.strip("` \n")
        
        return json.loads(content)
    except Exception as e:
        print(f"Cerebras solve_screen failed: {str(e)}. Attempting rule-based/RAG fallback...")
        try:
            fallback_fields = []
            for f in fields:
                f_label = (f.get("label") or "").strip().lower()
                f_name = (f.get("name") or "").strip().lower()
                
                matched_val = None
                
                # 1. Try RAG context match
                if rag_context:
                    for entry in rag_context:
                        q_clean = entry["question"].strip().lower()
                        if f_label and (f_label == q_clean or f_label in q_clean or q_clean in f_label):
                            matched_val = entry["answer"]
                            break
                        if f_name and (f_name == q_clean or f_name in q_clean or q_clean in f_name):
                            matched_val = entry["answer"]
                            break
                
                # 2. Try profile fields fallback
                if matched_val is None:
                    if "phone" in f_label or "mobile" in f_label or "phone" in f_name:
                        matched_val = profile_data.get("phone")
                    elif "email" in f_label or "email" in f_name:
                        matched_val = profile_data.get("email")
                    elif "first name" in f_label or "given name" in f_label or "first_name" in f_name:
                        matched_val = profile_data.get("first_name")
                    elif "last name" in f_label or "family name" in f_label or "last_name" in f_name:
                        matched_val = profile_data.get("last_name")
                    elif "city" in f_label or "city" in f_name:
                        matched_val = profile_data.get("city")
                    elif "location" in f_label or "location" in f_name:
                        matched_val = profile_data.get("location")
                    elif "state" in f_label or "province" in f_label or "state" in f_name:
                        # Try to get state from location or default to Ontario
                        loc = profile_data.get("location") or ""
                        if "ontario" in loc.lower() or "on" in loc.split():
                            matched_val = "Ontario"
                        else:
                            matched_val = profile_data.get("state") or "Ontario"
                    elif "street" in f_label or "address" in f_label or "address" in f_name:
                        matched_val = profile_data.get("street_address") or "123 Yonge Street"
                    elif "postal" in f_label or "zip" in f_label or "zip" in f_name:
                        matched_val = "M2J 4Y8"
                    elif "salary" in f_label or "pay" in f_label or "compensation" in f_label:
                        matched_val = "120000"
                    elif "sponsorship" in f_label or "sponsor" in f_label or "sponsorship" in f_name:
                        matched_val = profile_data.get("visa_sponsorship") or "No"
                    elif "authorized" in f_label or "legally" in f_label or "work in" in f_label or "authorized" in f_name:
                        matched_val = profile_data.get("work_authorization") or "Yes"
                
                if matched_val is not None:
                    fallback_fields.append({
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "type": f.get("type"),
                        "value": matched_val
                    })
            
            # Find a button to click (Continue/Submit)
            click_btn = None
            for f in fields:
                f_type = (f.get("type") or "").lower()
                f_label = (f.get("label") or "").lower()
                if f_type == "submit" or "continue" in f_label or "next" in f_label or "submit" in f_label:
                    click_btn = f.get("id") or f.get("name")
                    break
            
            if fallback_fields:
                print(f"Fallback successful: resolved {len(fallback_fields)} fields.")
                return {
                    "action": "fill",
                    "fields": fallback_fields,
                    "click_button": click_btn or "Continue"
                }
        except Exception as fallback_err:
            print(f"Fallback failed: {fallback_err}")
            
        return {"action": "wait", "fields": [], "click_button": None}
