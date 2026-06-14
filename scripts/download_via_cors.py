import urllib.request
import urllib.parse
import json
import sys
import re

if len(sys.argv) < 3:
    print("Usage: python3 download_via_cors.py <target_url> <output_file>")
    sys.exit(1)

target_url = sys.argv[1]
output_file = sys.argv[2]

proxies = [
    # Codetabs proxy (direct HTML)
    {"url": f"https://api.codetabs.com/v1/proxy?url={urllib.parse.quote(target_url, safe='')}", "type": "direct"},
    # Thingproxy (direct HTML)
    {"url": f"https://thingproxy.freeboard.io/fetch/{urllib.parse.quote(target_url, safe='')}", "type": "direct"},
    # AllOrigins (JSON wrapped)
    {"url": f"https://api.allorigins.win/get?url={urllib.parse.quote(target_url, safe='')}", "type": "allorigins"},
]

print(f"Attempting to download {target_url} using CORS proxies...")

for p in proxies:
    proxy_url = p["url"]
    ptype = p["type"]
    print(f"Trying CORS proxy ({ptype}): {proxy_url[:80]}...")
    try:
        req = urllib.request.Request(
            proxy_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read()
            if ptype == "allorigins":
                data = json.loads(content.decode('utf-8'))
                html_content = data.get("contents", "")
            else:
                html_content = content.decode('utf-8', errors='ignore')
            
            # Basic validation: we expect HTML page with DOCTYPE or at least some size
            if len(html_content) > 1000 and ("<!DOCTYPE html>" in html_content or "<html" in html_content):
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                print(f"Success! Saved {len(html_content)} characters to {output_file}")
                sys.exit(0)
            else:
                print(f"Proxy returned invalid/short content ({len(html_content)} bytes).")
    except Exception as e:
        print(f"Failed: {e}")

print("All CORS proxies failed.")
sys.exit(1)
