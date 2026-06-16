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

def test_email_credentials():
    print("\n=== Testing Email Credentials & Encryption ===")
    
    # 1. Register a temporary user
    email = f"email_test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "Test User",
        "email": email,
        "password": "Password@123"
    }
    status, res = request_json(f"{BASE_URL}/api/auth/register", method="POST", data=reg_data)
    if status != 200:
        print("Register failed. Make sure backend is running.")
        sys.exit(1)
    print(f"Registered user: {email}")
    
    # 2. Login
    login_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    login_data = {"username": email, "password": "Password@123"}
    req_data = urllib.parse.urlencode(login_data).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=req_data, headers=login_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            login_res = json.loads(response.read().decode("utf-8"))
            token = login_res["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)
        
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("Login successful. Obtained JWT token.")
    
    # 3. Save email credentials
    creds_payload = {
        "email_provider": "Gmail",
        "email": "test-gmail@gmail.com",
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_password": "supersecretpassword1",
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
        "imap_password": "supersecretpassword2"
    }
    
    status, save_res = request_json(
        f"{BASE_URL}/api/email-credentials", 
        method="POST", 
        data=creds_payload, 
        headers=auth_headers
    )
    assert status == 200, f"Failed to save credentials: {save_res}"
    print("Saved email credentials successfully.")
    assert save_res["email"] == "test-gmail@gmail.com"
    assert "smtp_password" not in save_res, "Sensitive password should not be in the response schema"
    assert "imap_password" not in save_res, "Sensitive password should not be in the response schema"
    
    # 4. Get saved email credentials
    status, get_res = request_json(
        f"{BASE_URL}/api/email-credentials", 
        method="GET", 
        headers=auth_headers
    )
    assert status == 200, f"Failed to retrieve credentials: {get_res}"
    print("Retrieved email credentials successfully.")
    assert get_res["email"] == "test-gmail@gmail.com"
    assert get_res["smtp_host"] == "smtp.gmail.com"
    
    # 5. Test credentials validation endpoint
    test_payload = {
        "email_provider": "Gmail",
        "email": "test-gmail@gmail.com",
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_password": "wrongpassword",
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
        "imap_password": "wrongpassword"
    }
    
    status, test_res = request_json(
        f"{BASE_URL}/api/email-credentials/test", 
        method="POST", 
        data=test_payload, 
        headers=auth_headers
    )
    assert status == 200, f"Test endpoint failed: {test_res}"
    print(f"Verified connection test endpoint. Result: {test_res}")
    assert test_res["success"] is False, "Expected false connection success due to invalid credentials"
    
    # 6. Delete email credentials
    status, del_res = request_json(
        f"{BASE_URL}/api/email-credentials", 
        method="DELETE", 
        headers=auth_headers
    )
    assert status == 200, f"Failed to delete credentials: {del_res}"
    print("Deleted email credentials successfully.")
    
    # 7. Verify deletion
    status, get_after_del = request_json(
        f"{BASE_URL}/api/email-credentials", 
        method="GET", 
        headers=auth_headers
    )
    assert status == 404, f"Expected 404 after deletion, got {status}: {get_after_del}"
    print("Verified email credentials no longer exist.")
    
    print("=== All Email Credentials tests passed! ===")

if __name__ == "__main__":
    test_email_credentials()
