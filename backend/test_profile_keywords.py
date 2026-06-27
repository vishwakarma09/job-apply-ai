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

def test_profile_keywords():
    print("\n=== Running Profile Keywords and Filters Test ===")
    
    # 1. Register a temporary user
    email = f"keywords_test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "Keywords Test User",
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
        data={"title": "Python Developer", "is_active": True},
        headers=auth_headers
    )
    assert status == 200, f"Failed to create profile A: {profile_a}"
    profile_a_id = profile_a["id"]
    print(f"Created Profile A (ID: {profile_a_id})")

    # 4. Create Profile B
    status, profile_b = request_json(
        f"{BASE_URL}/api/profiles",
        method="POST",
        data={"title": "Go Developer", "is_active": False},
        headers=auth_headers
    )
    assert status == 200, f"Failed to create profile B: {profile_b}"
    profile_b_id = profile_b["id"]
    print(f"Created Profile B (ID: {profile_b_id})")

    # 5. Update Profile A with unique keywords
    keywords_update = {
        "title": "Python Developer (Senior)",
        "job_location": "Remote, USA",
        "job_title_keywords": "Python, Django, FastAPI",
        "job_title_negative_keywords": "Java, PHP",
        "job_body_keywords": "Kubernetes, AWS, React",
        "job_body_negative_keywords": "Windows, COBOL"
    }
    status, updated_a = request_json(
        f"{BASE_URL}/api/profiles/{profile_a_id}",
        method="PUT",
        data=keywords_update,
        headers=auth_headers
    )
    assert status == 200, f"Failed to update profile A: {updated_a}"
    print("Updated Profile A with unique keywords.")

    # Verify that Profile A fields match the updated fields
    for key, expected_val in keywords_update.items():
        assert updated_a[key] == expected_val, f"Field '{key}' in profile A was '{updated_a[key]}', expected '{expected_val}'"
    print("Verified Profile A fields successfully updated.")

    # 6. Retrieve Profile B and check if it is UNCHANGED (since keywords should not sync)
    status, profiles_list = request_json(
        f"{BASE_URL}/api/profiles",
        method="GET",
        headers=auth_headers
    )
    assert status == 200, f"Failed to list profiles: {profiles_list}"
    
    b_retrieved = next((p for p in profiles_list if p["id"] == profile_b_id), None)
    assert b_retrieved is not None, "Profile B not found in list"
    
    # Assert keywords did NOT synchronize to Profile B
    assert b_retrieved["title"] == "Go Developer"
    assert b_retrieved["job_location"] is None or b_retrieved["job_location"] == ""
    assert b_retrieved["job_title_keywords"] is None or b_retrieved["job_title_keywords"] == ""
    assert b_retrieved["job_title_negative_keywords"] is None or b_retrieved["job_title_negative_keywords"] == ""
    print("Verified Profile B remains unchanged, proving keywords are unique per profile.")
    print("=== PROFILE KEYWORDS TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_profile_keywords()
