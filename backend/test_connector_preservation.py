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

def test_connector_preservation():
    print("\n=== Running Connector Preservation & Status Update Test ===")
    
    # 1. Register a temporary user
    email = f"connector_test_{int(time.time())}@aijobapply.com"
    reg_data = {
        "name": "Connector Test User",
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
    print("Login successful. Obtained JWT token.")
    
    # 3. Add a connector (defaults to Connected)
    connector_payload = {
        "platform_name": "LinkedIn",
        "credentials_json": json.dumps({"token": "old-token-123", "auth_method": "cookie"}),
        "status": "Connected"
    }
    status, add_res = request_json(
        f"{BASE_URL}/api/connectors",
        method="POST",
        data=connector_payload,
        headers=auth_headers
    )
    assert status == 200, f"Failed to add connector: {add_res}"
    connector_id = add_res["id"]
    print(f"Successfully added LinkedIn connector. ID: {connector_id}, Status: {add_res['status']}")
    assert add_res["status"] == "Connected", "Status should default/be set to Connected"
    
    # 4. Disconnect the connector (change status to Not Connected via PUT)
    update_payload = {
        "status": "Not Connected"
    }
    status, update_res = request_json(
        f"{BASE_URL}/api/connectors/{connector_id}",
        method="PUT",
        data=update_payload,
        headers=auth_headers
    )
    assert status == 200, f"Failed to update connector: {update_res}"
    print(f"Disconnected connector (status set to: {update_res['status']})")
    assert update_res["status"] == "Not Connected", "Status should be updated to Not Connected"
    
    # 5. Get connectors and check that credentials are still present
    status, get_res = request_json(
        f"{BASE_URL}/api/connectors",
        method="GET",
        headers=auth_headers
    )
    assert status == 200, f"Failed to get connectors: {get_res}"
    linkedin_conn = next((c for c in get_res if c["platform_name"] == "LinkedIn"), None)
    assert linkedin_conn is not None, "LinkedIn connector should still exist"
    assert linkedin_conn["status"] == "Not Connected", "LinkedIn status should be Not Connected"
    
    creds = json.loads(linkedin_conn["credentials_json"])
    assert creds["token"] == "old-token-123", "Credentials must be preserved after disconnection"
    print("Verified credentials are preserved after disconnection.")
    
    # 6. Edit credentials while disconnected (status remains Not Connected)
    new_creds_json = json.dumps({"username": "user@gmail.com", "password": "new-password-123", "auth_method": "credentials"})
    edit_payload = {
        "credentials_json": new_creds_json
    }
    status, edit_res = request_json(
        f"{BASE_URL}/api/connectors/{connector_id}",
        method="PUT",
        data=edit_payload,
        headers=auth_headers
    )
    assert status == 200, f"Failed to edit credentials: {edit_res}"
    print(f"Updated credentials (status is still: {edit_res['status']})")
    assert edit_res["status"] == "Not Connected", "Status should remain Not Connected after editing credentials only"
    
    # Check that credentials were updated
    creds = json.loads(edit_res["credentials_json"])
    assert creds["username"] == "user@gmail.com", "Credentials should be updated"
    assert creds["password"] == "new-password-123", "Credentials should be updated"
    
    # 7. Connect it again (status set to Connected via PUT)
    reconnect_payload = {
        "status": "Connected"
    }
    status, reconnect_res = request_json(
        f"{BASE_URL}/api/connectors/{connector_id}",
        method="PUT",
        data=reconnect_payload,
        headers=auth_headers
    )
    assert status == 200, f"Failed to reconnect connector: {reconnect_res}"
    print(f"Reconnected connector (status is now: {reconnect_res['status']})")
    assert reconnect_res["status"] == "Connected", "Status should be Connected"
    
    # 8. Delete the connector completely (Clear credentials)
    status, delete_res = request_json(
        f"{BASE_URL}/api/connectors/{connector_id}",
        method="DELETE",
        headers=auth_headers
    )
    assert status == 200, f"Failed to delete connector: {delete_res}"
    print("Successfully deleted/cleared connector from database.")
    
    # Verify it is deleted
    status, final_get = request_json(
        f"{BASE_URL}/api/connectors",
        method="GET",
        headers=auth_headers
    )
    assert status == 200
    assert not any(c["id"] == connector_id for c in final_get), "Connector should be deleted"
    print("Verification complete! Connector is successfully deleted.")
    print("=== CONNECTOR PRESERVATION TESTS PASSED! ===")

if __name__ == "__main__":
    test_connector_preservation()
