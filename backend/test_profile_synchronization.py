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
        print(f"HTTP Error: {e.code} - {err_content}")
        return e.code, err_content
    except Exception as e:
        print(f"Connection Error: {e}")
        return 0, str(e)

def test_profile_synchronization():
    print("\n=== Running Profile Synchronization Test ===")
    
    # 1. Register a temporary user
    email = f"sync_test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "Sync Test User",
        "email": email,
        "password": "Password@123"
    }
    status, res = request_json(f"{BASE_URL}/api/auth/register", method="POST", data=reg_data)
    if status != 200:
        print(f"Register failed (Status: {status}). Make sure backend is running.")
        sys.exit(1)
    print(f"Registered user: {email}")
    
    # 2. Login
    login_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    login_data = {"username": email, "password": "Password@123"}
    status, login_res = request_json(f"{BASE_URL}/api/auth/login", method="POST", data=login_data, headers=login_headers)
    if status != 200:
        print(f"Login failed: {login_res}")
        sys.exit(1)
    token = login_res["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 3. Create Profile A
    status, profile_a = request_json(
        f"{BASE_URL}/api/profiles",
        method="POST",
        data={"title": "Frontend Developer", "is_active": True},
        headers=auth_headers
    )
    assert status == 200, f"Failed to create profile A: {profile_a}"
    profile_a_id = profile_a["id"]
    print(f"Created Profile A (ID: {profile_a_id})")

    # 4. Create Profile B
    status, profile_b = request_json(
        f"{BASE_URL}/api/profiles",
        method="POST",
        data={"title": "Backend Developer", "is_active": False},
        headers=auth_headers
    )
    assert status == 200, f"Failed to create profile B: {profile_b}"
    profile_b_id = profile_b["id"]
    print(f"Created Profile B (ID: {profile_b_id})")

    # 5. Update Profile A's Auto-Fill Persona Settings
    persona_update = {
        "phone": "+1 (555) 123-4567",
        "email": "sync_test@domain.com",
        "city": "Vancouver, BC",
        "nationality": "Canadian",
        "visa_sponsorship": "No",
        "disability_status": "No",
        "veteran_status": "No",
        "ethnicity": "Decline",
        "gender": "Male",
        "languages": "English, French",
        "skills": "React: 5 years, JavaScript: 7 years",
        "work_authorization": "Canada"
    }
    status, updated_a = request_json(
        f"{BASE_URL}/api/profiles/{profile_a_id}",
        method="PUT",
        data=persona_update,
        headers=auth_headers
    )
    assert status == 200, f"Failed to update profile A: {updated_a}"
    print("Updated Profile A's persona settings.")

    # 6. Retrieve Profile B and check if settings synchronized
    status, profiles_list = request_json(
        f"{BASE_URL}/api/profiles",
        method="GET",
        headers=auth_headers
    )
    assert status == 200, f"Failed to list profiles: {profiles_list}"
    
    b_retrieved = next((p for p in profiles_list if p["id"] == profile_b_id), None)
    assert b_retrieved is not None, "Profile B not found in list"
    
    # Assert synchronization
    for key, expected_val in persona_update.items():
        assert b_retrieved[key] == expected_val, f"Field '{key}' in profile B was '{b_retrieved[key]}', expected '{expected_val}'"
    print("Verified Profile B synchronized successfully with Profile A's updates.")

    # 7. Create Profile C and verify it auto-populates/copies settings from existing profile
    status, profile_c = request_json(
        f"{BASE_URL}/api/profiles",
        method="POST",
        data={"title": "DevOps Engineer", "is_active": False},
        headers=auth_headers
    )
    assert status == 200, f"Failed to create profile C: {profile_c}"
    profile_c_id = profile_c["id"]
    print(f"Created Profile C (ID: {profile_c_id})")

    for key, expected_val in persona_update.items():
        assert profile_c[key] == expected_val, f"Field '{key}' in newly created profile C was '{profile_c[key]}', expected '{expected_val}'"
    print("Verified newly created Profile C was initialized with correct persona settings.")

    # 8. Test learn answers sync
    learn_payload = {
        "answers": {
            "what is your favorite programming language": "Python",
            "how many years of experience with Docker": "3"
        }
    }
    status, learn_res = request_json(
        f"{BASE_URL}/api/profiles/active/learn",
        method="POST",
        data=learn_payload,
        headers=auth_headers
    )
    assert status == 200, f"Learn failed: {learn_res}"
    print("Learned new screening answers.")

    # Verify answers_json is synchronized in all profiles (A, B, C)
    status, final_profiles = request_json(
        f"{BASE_URL}/api/profiles",
        method="GET",
        headers=auth_headers
    )
    assert status == 200
    for p in final_profiles:
        answers = json.loads(p["answers_json"])
        assert answers.get("what is your favorite programming language") == "Python", f"answers_json not sync'd for profile {p['title']}"
        assert answers.get("how many years of experience with docker") == "3", f"answers_json not sync'd for profile {p['title']}"
    print("Verified learned answers (answers_json) synchronized across all profiles.")
    print("=== ALL PROFILE SYNCHRONIZATION TESTS PASSED! ===")

if __name__ == "__main__":
    test_profile_synchronization()
