import urllib.request
import json
import ssl
import sys

if len(sys.argv) < 3:
    print("Usage: python3 download_html.py <target_url> <output_file>")
    sys.exit(1)

target_url = sys.argv[1]
output_file = sys.argv[2]

# Get proxies
try:
    proxies_url = "https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps"
    req = urllib.request.Request(proxies_url, headers={'User-Agent': 'Mozilla/5.0'})
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))['data']
except Exception as e:
    print(f"Failed to fetch proxy list: {e}")
    sys.exit(1)

print(f"Found {len(data)} proxies. Trying to download...")

for item in data:
    ip = item['ip']
    port = item['port']
    protocol = item['protocols'][0]
    proxy_str = f"{protocol}://{ip}:{port}"
    print(f"Trying proxy: {proxy_str}...")
    
    try:
        proxy_handler = urllib.request.ProxyHandler({'http': proxy_str, 'https': proxy_str})
        opener = urllib.request.build_opener(proxy_handler)
        req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
        # Use a short timeout of 4 seconds to fail fast
        with opener.open(req, timeout=4) as response:
            content = response.read()
            # The safebrowse block page or error pages are small, the actual pages are >20KB
            if len(content) > 5000:
                # Double-check it doesn't contain safebrowse or threat words
                content_str = content.decode('utf-8', errors='ignore')
                if "Risky" in content_str or "Threat Detected" in content_str or "safebrowse" in content_str:
                    print("Proxy returned intercepted block page, skipping...")
                    continue
                with open(output_file, 'wb') as f:
                    f.write(content)
                print(f"Success using proxy {proxy_str}! Saved {len(content)} bytes to {output_file}.")
                sys.exit(0)
            else:
                print(f"Proxy returned short content ({len(content)} bytes), skipping...")
    except Exception as e:
        print(f"Failed: {e}")

print("All proxies failed.")
sys.exit(1)
