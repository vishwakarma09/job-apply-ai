import smtplib
import imaplib
import re
import time
from email import message_from_bytes
from typing import Optional

def clean_str(val: str) -> str:
    if not val:
        return ""
    # Strip normal spaces, non-breaking spaces (\xa0), tabs, newlines
    return val.strip().replace(" ", "").replace("\xa0", "").replace("\t", "").replace("\n", "").replace("\r", "")

def test_smtp_connection(host: str, port: int, username: str, password: str) -> bool:
    host = clean_str(host)
    username = clean_str(username)
    password = clean_str(password)
    try:
        # Determine if SSL or STARTTLS
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.starttls()
        
        server.login(username, password)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP connection test failed: {e}")
        return False

def test_imap_connection(host: str, port: int, username: str, password: str) -> bool:
    host = clean_str(host)
    username = clean_str(username)
    password = clean_str(password)
    try:
        mail = imaplib.IMAP4_SSL(host, port, timeout=10)
        mail.login(username, password)
        mail.logout()
        return True
    except Exception as e:
        print(f"IMAP connection test failed: {e}")
        return False

def extract_otp_from_text(text: str) -> Optional[str]:
    # Look for 4-8 digit numbers, possibly labeled as verification code / code / pin / OTP
    patterns = [
        r"(?i)(?:code|verification|otp|pin|passcode)\b.*?(\d{4,8})",
        r"\b(\d{5,8})\b",  # Any 5-8 digit number stand-alone
        r"\b(\d{4})\b",    # 4 digit number
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None

def fetch_latest_otp(
    host: str,
    port: int,
    username: str,
    password: str,
    sender_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
    timeout_seconds: int = 60,
    poll_interval: int = 5
) -> Optional[str]:
    host = clean_str(host)
    username = clean_str(username)
    password = clean_str(password)
    start_time = time.time()
    
    while time.time() - start_time < timeout_seconds:
        try:
            mail = imaplib.IMAP4_SSL(host, port, timeout=10)
            mail.login(username, password)
            mail.select("inbox")
            
            # Formulate search criteria
            criteria = []
            if sender_filter:
                criteria.append(f'(FROM "{sender_filter}")')
            if subject_filter:
                criteria.append(f'(SUBJECT "{subject_filter}")')
            
            search_query = " ".join(criteria) if criteria else "ALL"
            
            status, messages = mail.search(None, search_query)
            if status == "OK" and messages[0]:
                msg_ids = messages[0].split()
                # Check from newest message (reverse order)
                for msg_id in reversed(msg_ids):
                    status, data = mail.fetch(msg_id, "(RFC822)")
                    if status == "OK":
                        raw_email = data[0][1]
                        msg = message_from_bytes(raw_email)
                        
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))
                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    body += part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        else:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                        
                        otp = extract_otp_from_text(body)
                        if otp:
                            mail.logout()
                            return otp
            mail.logout()
        except Exception as e:
            print(f"Error while polling for OTP email: {e}")
        
        time.sleep(poll_interval)
    
    return None
