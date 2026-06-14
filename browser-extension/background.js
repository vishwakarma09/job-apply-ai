// background.js
// Service worker for AI Job Apply Assistant extension

chrome.runtime.onInstalled.addListener(() => {
  console.log("[AI Job Apply Extension] Service worker installed successfully.");
  chrome.storage.local.get(["apiUrl"], (data) => {
    if (!data.apiUrl || data.apiUrl === "undefined" || data.apiUrl === "null") {
      chrome.storage.local.set({ apiUrl: "http://localhost:8000" }, () => {
        console.log("[AI Job Apply Extension] Default backend API URL set to http://localhost:8000");
      });
    }
  });
});

// Message listener to proxy backend requests and bypass content-script CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchBackend") {
    const { url, options } = request;

    // Safety validation: Prevent fetching relative/invalid URLs which Chrome redirects to chrome-extension://invalid/
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      console.warn("[AI Job Apply Extension] Blocked invalid proxy URL:", url);
      sendResponse({ success: false, error: "Invalid absolute URL: " + url });
      return;
    }

    fetch(url, options)
      .then(async (response) => {
        const isOk = response.ok;
        const status = response.status;
        let data = null;
        
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          console.warn("[AI Job Apply Extension] Failed to parse response JSON:", e);
        }

        sendResponse({ success: isOk, status, data });
      })
      .catch((error) => {
        console.error("[AI Job Apply Extension] Proxy fetch failed:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keeps the message channel open for asynchronous sendResponse
  }
});
