// popup.js
// Logic for AI Job Apply Chrome Extension popup

const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_FRONTEND_URL = "http://localhost:5173";

document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const userEmailText = document.getElementById("user-email");
  const activeProfileText = document.getElementById("active-profile");
  const activeResumeText = document.getElementById("active-resume");
  
  const dashboardBtn = document.getElementById("btn-dashboard");
  const settingsToggleBtn = document.getElementById("btn-settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  
  const apiUrlInput = document.getElementById("input-api-url");
  const tokenInput = document.getElementById("input-token");
  const saveSettingsBtn = document.getElementById("btn-save-settings");

  // Toggle settings panel
  settingsToggleBtn.addEventListener("click", () => {
    const isOpen = settingsPanel.classList.toggle("open");
    settingsToggleBtn.innerText = isOpen ? "Close Settings" : "Settings";
  });

  // Load settings and check connection
  const loadSettingsAndVerify = () => {
    chrome.storage.local.get(["token", "apiUrl"], (data) => {
      const apiUrl = data.apiUrl || DEFAULT_API_URL;
      const token = data.token || "";

      apiUrlInput.value = apiUrl;
      tokenInput.value = token;

      if (!token) {
        showDisconnected("No Token Saved");
        return;
      }

      verifyConnection(apiUrl, token);
    });
  };

  // Verify connection with FastAPI backend
  const verifyConnection = (apiUrl, token) => {
    statusBadge.className = "badge disconnected";
    statusText.innerText = "Connecting...";

    // 1. Check Auth Me
    fetch(`${apiUrl}/api/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    })
    .then(user => {
      userEmailText.innerText = user.email;
      
      // 2. Check Active Profile
      return fetch(`${apiUrl}/api/profiles/active`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
    })
    .then(res => {
      if (res.status === 404) {
        return { title: "No Profile Configured", resume: null };
      }
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    })
    .then(profile => {
      statusBadge.className = "badge connected";
      statusText.innerText = "Connected";
      activeProfileText.innerText = profile.title;
      activeResumeText.innerText = profile.resume ? profile.resume.filename : "No Resume Uploaded";
    })
    .catch(err => {
      console.error(err);
      showDisconnected("Session Expired");
    });
  };

  const showDisconnected = (message) => {
    statusBadge.className = "badge disconnected";
    statusText.innerText = message;
    userEmailText.innerText = "Disconnected";
    activeProfileText.innerText = "-";
    activeResumeText.innerText = "-";
  };

  // Save settings manual override
  saveSettingsBtn.addEventListener("click", () => {
    const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
    const token = tokenInput.value.trim();

    chrome.storage.local.set({ apiUrl, token }, () => {
      alert("Settings saved successfully!");
      settingsPanel.classList.remove("open");
      settingsToggleBtn.innerText = "Settings";
      loadSettingsAndVerify();
    });
  });

  // Open Dashboard link
  dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: DEFAULT_FRONTEND_URL });
  });

  // Initial load
  loadSettingsAndVerify();
});
