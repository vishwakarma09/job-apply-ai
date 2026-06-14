import urllib.request
import os

screens = {
    "landing_page.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzM5M2E0MmJkODEwYTRjZmFiYzY0ZjAxN2NhNGFiYTBkEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "pricing_plans.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzZiNmQ0ZjVmMTkwZjQ0MmFhMzI2ZmEwODA4YWM2YzcyEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "login.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzE1MmFmMmM4MzVlYzQxZDNiMWJmYWRjYWNhMGVjZDNiEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "register.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzQ3NmU2NjE5YTJiYjQ0YzRhZTM5ZGI3ZTk2ODM4MGM5EgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "forgot_password.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2MwOTBmYTkzZGZhOTRmYzJhNzI5N2FmMzFjOTgwZmJhEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "dashboard.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2Q5YWJjNjgzYTZmMDQyZDc5NzViZGIzY2EwNzMyMDFkEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "profile_creation.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzlkMTliNTc3ZGM1OTRkMWZhNzk0OTllMjg0NmFkOTdkEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "connectors.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzczMDc5NmZhZmI5ZjQzYzI4MTJjNTAzMGRmMzMyZTJkEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "jobs_kanban.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2E5MzljZWQyODYxYjQzNTU5YjFmZTRjMmQ3NDFhZDM4EgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242",
    "job_detail.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzExNzg1ZTdjMGQzYTRlNDk4YjFhNzk2ZmIyYzljNDAxEgsSBxCV-7mRhxYYAZIBIwoKcHJvamVjdF9pZBIVQhMyNzY0MjIwMjYwMjM1NzYzNTMz&filename=&opi=96797242"
}

output_dir = "docs/pages"
os.makedirs(output_dir, exist_ok=True)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

for filename, url in screens.items():
    dest = os.path.join(output_dir, filename)
    print(f"Downloading {filename}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read()
            with open(dest, "wb") as f:
                f.write(content)
            print(f"Successfully saved {filename} ({len(content)} bytes)")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")

print("Done!")
