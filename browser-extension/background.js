// background.js
// Service worker for AI Job Apply Assistant extension

let masterTabId = null;
const retryTabIds = new Set();

// Clear any stale automation states on service worker startup
chrome.storage.local.remove(["turbo_mode_active", "currently_applying_job_id"]);

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

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === masterTabId) {
    masterTabId = null;
    console.log("[Background] Master tab closed.");
  }
  if (retryTabIds.has(tabId)) {
    retryTabIds.delete(tabId);
    console.log("[Background] Retry tab closed:", tabId);
  }
});

// Message listener to proxy backend requests and bypass content-script CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setMasterTab") {
    masterTabId = sender.tab ? sender.tab.id : null;
    console.log("[Background] Master tab registered:", masterTabId);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "checkTabRole") {
    const tabId = sender.tab ? sender.tab.id : null;
    const isMaster = (tabId !== null && tabId === masterTabId);
    const isRetrySub = (tabId !== null && retryTabIds.has(tabId));
    const turboActive = (masterTabId !== null);
    sendResponse({ success: true, isMaster, isRetrySub, turboModeActive: turboActive });
    return true;
  }

  if (request.action === "openTab") {
    const { url } = request;
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      chrome.tabs.create({ url }, (tab) => {
        if (tab && tab.id) {
          retryTabIds.add(tab.id);
        }
        sendResponse({ success: true, tabId: tab ? tab.id : null });
      });
      return true;
    } else {
      sendResponse({ success: false, error: "Invalid URL: " + url });
      return;
    }
  }

  if (request.action === "checkIndeedTabs") {
    chrome.tabs.query({}, (tabs) => {
      const indeedTabs = tabs.filter(t => {
        const url = t.url || t.pendingUrl || "";
        return url.includes("smartapply.indeed.com") || url.includes("profile.indeed.com");
      });
      sendResponse({ success: true, tabCount: indeedTabs.length });
    });
    return true;
  }

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
