import urllib.request
import urllib.parse
import json
import sys
import time

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
        print(f"HTTP Error: {e.code} - {err_content}")
        return e.code, err_content
    except Exception as e:
        print(f"Connection Error: {e}")
        return 0, str(e)

def test_flows():
    print("\n--- Test Flow 1: Register and Login Flow ---")
    # Register new user
    email = f"test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "Jane Doe",
        "email": email,
        "password": "Password@123"
    }
    status, res = request_json(f"{BASE_URL}/api/auth/register", method="POST", data=reg_data)
    assert status == 200, f"Register failed: {res}"
    print(f"Successfully registered user: {res['email']}")
    
    # Login
    login_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    login_data = {"username": email, "password": "Password@123"}
    status, login_res = request_json(f"{BASE_URL}/api/auth/login", method="POST", data=login_data, headers=login_headers)
    assert status == 200, f"Login failed: {login_res}"
    token = login_res["access_token"]
    print("Successfully logged in, JWT token retrieved.")
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Get Me
    status, me_res = request_json(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert status == 200, f"Get Me failed: {me_res}"
    assert me_res["email"] == email, "Get Me returned incorrect email"
    print("Auth /me endpoint verified.")
    
    print("\n--- Test Flow 2: Create Resume & Profile ---")
    # In tests, we create a Job Profile with a mock resume
    # Let's upload a mock resume first
    # Using multipart form-data mock or we can manually invoke it.
    # To keep the integration test simple, we can write a plain text mock resume
    # Wait, upload-resume accepts multi-part file.
    # Let's format multipart/form-data manually in urllib
    boundary = "---BoundaryJobApplyTest"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="my_mock_resume.txt"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
        f"Jane Doe Resume. Experience: Python Dev, FastAPI, React.\r\n"
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
    try:
        with urllib.request.urlopen(req) as response:
            res_content = response.read().decode("utf-8")
            resume_res = json.loads(res_content)
            resume_id = resume_res["id"]
            print(f"Successfully uploaded mock resume. ID: {resume_id}")
    except Exception as e:
        print(f"Failed to upload resume: {e}")
        sys.exit(1)
        
    # Create Job Profile
    profile_payload = {
        "title": "Senior Python Engineer",
        "is_active": True,
        "resume_id": resume_id
    }
    status, profile_res = request_json(f"{BASE_URL}/api/profiles", method="POST", data=profile_payload, headers=auth_headers)
    assert status == 200, f"Job profile creation failed: {profile_res}"
    profile_id = profile_res["id"]
    print(f"Successfully created active job profile: {profile_res['title']}")
    
    print("\n--- Test Flow 3: Add Connectors ---")
    connector_payload = {
        "platform_name": "LinkedIn",
        "credentials_json": '{"cookie": "dummy_test_cookie_999"}'
    }
    status, conn_res = request_json(f"{BASE_URL}/api/connectors", method="POST", data=connector_payload, headers=auth_headers)
    assert status == 200, f"Connector creation failed: {conn_res}"
    print(f"Successfully connected job board: {conn_res['platform_name']}")
    
    print("\n--- Test Flow 4: Apply for Job & Tailor Application ---")
    job_payload = {
        "platform_name": "LinkedIn",
        "title": "Senior Python Engineer",
        "company_name": "InnovateAI",
        "location": "New York, NY",
        "salary": "$160k - $190k",
        "job_url": "https://innovate.ai/jobs/python",
        "status": "applied",
        "job_profile_id": profile_id
    }
    status, job_res = request_json(f"{BASE_URL}/api/jobs", method="POST", data=job_payload, headers=auth_headers)
    assert status == 200, f"Applied job creation failed: {job_res}"
    job_id = job_res["id"]
    print(f"Successfully created applied job tracker entry: {job_res['title']} at {job_res['company_name']}")
    
    # Tailor Application (Cover Letter generation)
    tailor_payload = {
        "job_description": "We need a Senior Python Engineer experienced in FastAPI and React.",
        "job_profile_id": profile_id
    }
    status, tailor_res = request_json(f"{BASE_URL}/api/jobs/{job_id}/tailor", method="POST", data=tailor_payload, headers=auth_headers)
    assert status == 200, f"Tailoring failed: {tailor_res}"
    print(f"Successfully generated tailored cover letter of {len(tailor_res['content'])} characters.")
    
    # Verify Recruiter timeline conversation
    convo_payload = {
        "sender": "Recruiter",
        "message_text": "We reviewed your application and cover letter. Let's schedule a call.",
        "platform": "email"
    }
    status, convo_res = request_json(f"{BASE_URL}/api/conversations/{job_id}", method="POST", data=convo_payload, headers=auth_headers)
    assert status == 200, f"Adding conversation failed: {convo_res}"
    print("Recruiter conversation timeline entry verified.")
    
    print("\n--- Test Flow 5: Billing & Free Trial Promocode Bypass ---")
    # List plans
    status, plans = request_json(f"{BASE_URL}/api/billing/plans", headers=auth_headers)
    assert status == 200, f"Getting plans failed: {plans}"
    plan_pro = [p for p in plans if p["name"] == "Pro"][0]
    
    # Try purchasing with FREETRIAL promocode (bypasses Stripe checkout)
    checkout_payload = {
        "plan_id": plan_pro["id"],
        "promo_code": "FREETRIAL"
    }
    status, checkout_res = request_json(f"{BASE_URL}/api/billing/checkout", method="POST", data=checkout_payload, headers=auth_headers)
    assert status == 200, f"Checkout failed: {checkout_res}"
    assert checkout_res["status"] == "completed", "Free trial checkout order should be immediately completed"
    assert checkout_res["stripe_session_id"] == "free_trial_bypass", "Expected checkout bypass stripe_session_id"
    print("Successfully purchased plan with FREETRIAL discount.")
    
    # Verify user premium status
    status, me_premium = request_json(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert status == 200
    assert me_premium["is_premium"] is True, "User should be premium after FREETRIAL checkout bypass"
    print("User premium status verified successfully!")
    
    # Try using FREETRIAL again (should fail because discount is one-time use only)
    status, checkout_res_fail = request_json(f"{BASE_URL}/api/billing/checkout", method="POST", data=checkout_payload, headers=auth_headers)
    assert status == 400, f"Expected 400 Bad Request for duplicate free trial use, got {status}: {checkout_res_fail}"
    print("One-time use restriction for FREETRIAL verified successfully.")
    
    print("\n--- Test Flow 6: Change Password ---")
    # Change password with wrong current password (should return 400)
    change_pw_fail_payload = {
        "current_password": "wrong_password",
        "new_password": "NewPassword@123"
    }
    status, change_pw_fail_res = request_json(f"{BASE_URL}/api/auth/change-password", method="POST", data=change_pw_fail_payload, headers=auth_headers)
    assert status == 400, f"Expected 400 Bad Request for incorrect current password, got {status}: {change_pw_fail_res}"
    print("Correctly rejected password update with incorrect current password.")

    # Change password with correct current password (should succeed)
    change_pw_success_payload = {
        "current_password": "Password@123",
        "new_password": "NewPassword@123"
    }
    status, change_pw_success_res = request_json(f"{BASE_URL}/api/auth/change-password", method="POST", data=change_pw_success_payload, headers=auth_headers)
    assert status == 200, f"Expected 200 OK for password update, got {status}: {change_pw_success_res}"
    print("Successfully changed password.")

    # Try logging in with the old password (should fail)
    login_data_old = {"username": email, "password": "Password@123"}
    status, login_res_old = request_json(f"{BASE_URL}/api/auth/login", method="POST", data=login_data_old, headers=login_headers)
    assert status == 401, f"Expected 401 Unauthorized for old password, got {status}: {login_res_old}"
    print("Successfully blocked login with old password.")

    # Try logging in with the new password (should succeed)
    login_data_new = {"username": email, "password": "NewPassword@123"}
    status, login_res_new = request_json(f"{BASE_URL}/api/auth/login", method="POST", data=login_data_new, headers=login_headers)
    assert status == 200, f"Login failed with new password: {login_res_new}"
    print("Successfully logged in with new password!")
    
    print("\n--- Test Flow 7: Support Ticket Submission ---")
    support_payload = {
        "name": "Jane Support",
        "email": "jane@example.com",
        "subject": "Unable to connect Cerebras API key",
        "message": "It fails with an invalid key error, but the key is active in Cerebras dashboard."
    }
    status, support_res = request_json(f"{BASE_URL}/api/support", method="POST", data=support_payload)
    assert status == 201, f"Support ticket creation failed: {support_res}"
    assert support_res["name"] == "Jane Support"
    assert support_res["subject"] == "Unable to connect Cerebras API key"
    assert support_res["status"] == "Open"
    assert "id" in support_res
    print("Support ticket submission flow verified successfully!")
    
    print("\n--- ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_flows()
