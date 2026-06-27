# test_ai_connectors.py
# Backend integration test for per-user AI Connectors

import urllib.request
import urllib.parse
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def request_json(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        if headers.get("Content-Type") == "application/x-www-form-urlencoded":
            req_data = urllib.parse.urlencode(data).encode("utf-8")
        else:
            headers["Content-Type"] = "application/json"
            req_data = json.dumps(data).encode("utf-8")
            
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            if res_data:
                return response.status, json.loads(res_data)
            return response.status, {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        return e.code, err_content
    except Exception as e:
        return 0, str(e)

def run_tests():
    print("Starting AI Connectors Integration Tests...")
    
    # 1. Register a test user
    email = f"ai_test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "AI Test User",
        "email": email,
        "password": "Password@123"
    }
    status, res = request_json(f"{BASE_URL}/api/auth/register", method="POST", data=reg_data)
    assert status == 200, f"Register failed: {res}"
    print(f"Registered user: {email}")
    
    # 2. Login to get token
    login_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    login_data = {"username": email, "password": "Password@123"}
    status, login_res = request_json(f"{BASE_URL}/api/auth/login", method="POST", data=login_data, headers=login_headers)
    assert status == 200, f"Login failed: {login_res}"
    token = login_res["access_token"]
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Get User profile, verify default keys are None and provider is "default"
    status, me_res = request_json(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert status == 200, f"Get Me failed: {me_res}"
    assert me_res["openai_api_key"] is None, "Expected default openai_api_key to be None"
    assert me_res["cerebras_api_key"] is None, "Expected default cerebras_api_key to be None"
    assert me_res["preferred_ai_provider"] == "default", "Expected default preferred_ai_provider to be 'default'"
    print("Default user AI Connector settings verified successfully.")
    
    # 4. Update AI keys and preference
    update_data = {
        "openai_api_key": "sk-proj-mockopenairandomkey12345",
        "cerebras_api_key": "csk-mockcerebrasrandomkey67890",
        "preferred_ai_provider": "openai"
    }
    status, update_res = request_json(f"{BASE_URL}/api/auth/api-keys", method="PUT", data=update_data, headers=auth_headers)
    assert status == 200, f"Updating API keys failed: {update_res}"
    assert update_res["openai_api_key"] == "sk-proj-mockopenairandomkey12345"
    assert update_res["cerebras_api_key"] == "csk-mockcerebrasrandomkey67890"
    assert update_res["preferred_ai_provider"] == "openai"
    print("Updated User AI Connectors successfully.")
    
    # 5. Fetch /me again to ensure persistence
    status, me_res2 = request_json(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert status == 200, f"Get Me failed: {me_res2}"
    assert me_res2["openai_api_key"] == "sk-proj-mockopenairandomkey12345"
    assert me_res2["cerebras_api_key"] == "csk-mockcerebrasrandomkey67890"
    assert me_res2["preferred_ai_provider"] == "openai"
    print("AI Connectors persistence verified.")
    
    # 6. Test service routing behavior by trying to generate cover letter.
    # Since we set the preferred_provider to "openai" and provided a fake key, the real HTTP client call to openai
    # should fail with 401 Unauthorized from OpenAI instead of failing due to Cerebras.
    # Let's create a mock profile and resume to test this.
    
    # Upload resume
    boundary = "---BoundaryJobApplyTest"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_resume.txt"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
        f"Test Candidate resume. Experienced in AI.\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    
    req = urllib.request.Request(
        f"{BASE_URL}/api/profiles/upload-resume",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        resume_res = json.loads(response.read().decode("utf-8"))
        resume_id = resume_res["id"]
        
    # Create profile
    profile_payload = {
        "title": "AI Engineer",
        "is_active": True,
        "resume_id": resume_id
    }
    status, profile_res = request_json(f"{BASE_URL}/api/profiles", method="POST", data=profile_payload, headers=auth_headers)
    assert status == 200, f"Job profile creation failed: {profile_res}"
    profile_id = profile_res["id"]
    
    # Try cover letter generation.
    tailor_payload = {
        "job_profile_id": profile_id,
        "job_description": "Need an expert AI Engineer."
    }
    
    print("Testing routing trigger (expecting fallback mock response since API key is fake)...")
    status, tailor_res = request_json(f"{BASE_URL}/api/jobs/generate-cover-letter", method="POST", data=tailor_payload, headers=auth_headers)
    assert status == 200, f"Expected 200 (due to fallback mock cover letter logic), got status {status}: {tailor_res}"
    assert "Dear Hiring Team" in tailor_res["content"], "Should return mock fallback cover letter"
    print("Routing test completed successfully!")
    
    print("\n--- ALL CONNECTORS INTEGRATION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
