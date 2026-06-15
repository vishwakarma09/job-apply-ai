// content.js
// Chrome Extension Content Script for AI Job Apply with Modular Platform Connectors

let ActiveConnector = null;

// Immediate evaluation log for debugging smartapply tab loading
debugRemoteLog("Script evaluated on: " + window.location.href);

if (window.location.hostname.includes("indeed.com") || window.location.hostname.includes("linkedin.com") || window.location.hostname.includes("greenhouse.io")) {
  // ActiveConnector is initialized in main widget engine block
  window.addEventListener("AI_JOB_APPLY_INTERCEPTED_OPEN", (event) => {
    const { url } = event.detail;
    console.log("[AI Job Apply Content Script] Received intercepted open request for url:", url);
    
    if (!isContextValid()) return;
    
    chrome.storage.local.get(["currently_applying_job_id"], (data) => {
      if (!isContextValid()) return;
      
      let activeId = data.currently_applying_job_id;
      if (!activeId) {
        try {
          if (ActiveConnector) {
            activeId = ActiveConnector.getJobId();
          }
        } catch (e) {
          console.warn("[AI Job Apply] Error calling getJobId inside intercept:", e);
        }
      }
      
      let targetUrl = url;
      if (activeId) {
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.set("extensionActiveJobId", activeId);
          targetUrl = urlObj.toString();
          console.log("[AI Job Apply Content Script] Appended active job ID to URL:", targetUrl);
        } catch (e) {
          console.warn("[AI Job Apply] Failed to append job ID to intercepted URL:", e);
        }
      }
      
      chrome.runtime.sendMessage({ action: "openTab", url: targetUrl }, (res) => {
        if (chrome.runtime.lastError) {
          console.error("[AI Job Apply] Failed to open intercepted tab via background:", chrome.runtime.lastError.message);
        }
      });
    });
  });

  // Also intercept programmatic click event on link tags with target="_blank"
  document.addEventListener("click", (e) => {
    let target = e.target.closest("a");
    if (target && target.target === "_blank") {
      // If clicked programmatically (untrusted click)
      if (!e.isTrusted) {
        e.preventDefault();
        let url = target.href;
        
        if (!isContextValid()) return;
        
        chrome.storage.local.get(["currently_applying_job_id"], (data) => {
          if (!isContextValid()) return;
          
          let activeId = data.currently_applying_job_id;
          if (!activeId) {
            try {
              if (ActiveConnector) {
                activeId = ActiveConnector.getJobId();
              }
            } catch (err) {
              console.warn("[AI Job Apply] Error calling getJobId inside click intercept:", err);
            }
          }
          
          if (activeId) {
            try {
              const urlObj = new URL(url);
              urlObj.searchParams.set("extensionActiveJobId", activeId);
              url = urlObj.toString();
            } catch (err) {
              console.warn("[AI Job Apply] Failed to append job ID to click URL:", err);
            }
          }
          
          console.log("[AI Job Apply] Intercepted programmatic click on target=_blank link:", url);
          chrome.runtime.sendMessage({ action: "openTab", url });
        });
      }
    }
  }, true);
}



// ==========================================
// 1. TOKEN SYNCHRONIZATION (LOCALHOST)
// ==========================================
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  let syncInterval = null;

  const syncToken = () => {
    if (!isContextValid()) {
      if (syncInterval) clearInterval(syncInterval);
      return;
    }

    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    try {
      chrome.storage.local.get(["token"], (result) => {
        if (!isContextValid()) return;
        
        if (token && result.token !== token) {
          chrome.storage.local.set({ 
            token: token, 
            user: user ? JSON.parse(user) : null,
            apiUrl: API_DEFAULT_URL 
          }, () => {
            console.log("[AI Job Apply Extension] Auth token synchronized successfully!");
          });
        } else if (!token && result.token) {
          chrome.storage.local.remove(["token", "user"], () => {
            console.log("[AI Job Apply Extension] Auth token cleared (logged out on dashboard).");
          });
        }
      });
    } catch (e) {
      console.warn("[AI Job Apply Extension] Storage sync failed (extension context likely invalidated):", e);
      if (syncInterval) clearInterval(syncInterval);
    }
  };

  // Sync immediately and monitor on interval
  syncToken();
  syncInterval = setInterval(syncToken, 2000);
}

// 2. MODULAR PLATFORM CONNECTORS FRAMEWORK
// ==========================================
// Platform connectors and helper functions have been moved to:
// - common/constants.js
// - common/helper.js
// - connectors/linkedin/index.js
// - connectors/indeed/index.js

// ==========================================
// 3. MAIN WIDGET ENGINE & AUTO-APPLY LOOP
// ==========================================
if (window.location.hostname.includes("linkedin.com") || window.location.hostname.includes("indeed.com") || window.location.hostname.includes("greenhouse.io")) {
  if (window.location.hostname.includes("indeed.com")) {
    ActiveConnector = Connectors.Indeed;
  } else if (window.location.hostname.includes("linkedin.com")) {
    ActiveConnector = Connectors.LinkedIn;
  } else if (window.location.hostname.includes("greenhouse.io")) {
    ActiveConnector = Connectors.Greenhouse;
  }
  let activeJobId = null;
  let shadowRoot = null;
  let currentJobData = null;
  let scrapeTimeout = null;
  let turboRunning = false;
  let scraperInterval = null;



  // Helper to send log events back to the backend
  const remoteLog = (level, message, jobId = null) => {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.get(["token", "apiUrl"], (data) => {
        if (!isContextValid()) return;
        let api = data.apiUrl || API_DEFAULT_URL;
        if (api === "undefined" || api === "null") {
          api = API_DEFAULT_URL;
        }
        const token = data.token;
        if (!token) return;

        fetchBackend(`${api}/api/jobs/extension-logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            level: level,
            message: message,
            timestamp: new Date().toISOString(),
            job_id: jobId ? String(jobId) : null,
            platform: ActiveConnector.name.toLowerCase()
          })
        }).catch(err => {
          console.warn("[AI Job Apply] Remote log failed:", err);
        });
      });
    } catch (e) {
      console.warn("[AI Job Apply] Error sending remote log:", e);
    }
  };


  // Poll for job changes since LinkedIn is a SPA
  const initScraper = () => {
    if (window.location.hostname.includes("greenhouse.io")) {
      chrome.storage.local.get(["greenhouse_turbo_state"], (res) => {
        if (!isContextValid()) return;
        const state = res.greenhouse_turbo_state;
        if (state && state.active) {
          console.log("[AI Job Apply] Resuming Greenhouse Turbo Mode...", state);
          resumeGreenhouseTurboMode(state);
          return;
        }
        continueScraperSetup();
      });
      return;
    }

    // Check if we are running in Indeed's Smart Apply flow tab or Profile Resume page
    const isSmartApply = window.location.hostname.includes("smartapply.indeed.com");
    const isProfileResume = window.location.hostname.includes("profile.indeed.com") && window.location.pathname.includes("/resume");
    
    if (isSmartApply || isProfileResume) {
      console.log("[AI Job Apply] Indeed Smart Apply or Profile page detected. URL: " + window.location.href);
      
      chrome.storage.local.get(["token", "apiUrl", "currently_applying_job_id"], (data) => {
        const api = data.apiUrl || API_DEFAULT_URL;
        const token = data.token;
        
        let jobId = null;
        try {
          const urlObj = new URL(window.location.href);
          jobId = urlObj.searchParams.get("extensionActiveJobId");
        } catch (e) {}
        
        if (jobId) {
          console.log("[AI Job Apply] Retaining active Job ID from URL param:", jobId);
          chrome.storage.local.set({ currently_applying_job_id: jobId });
        } else {
          jobId = data.currently_applying_job_id;
        }

        console.log("[AI Job Apply] Indeed Smart Apply or Profile page detected. URL: " + window.location.href + " | Job ID: " + jobId);
        
        if (!token) {
          console.warn("[AI Job Apply] No credentials found. Auto-fill aborted.");
          return;
        }

        fetchBackend(`${api}/api/profiles/active`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
        .then(profile => {
          if (!isContextValid()) return;
          console.log("[AI Job Apply] Active profile loaded:", profile.title);
          
          if (isProfileResume) {
            // Handle Profile Resume redirect page
            const urlParams = new URLSearchParams(window.location.search);
            const continueUrl = urlParams.get("continue");
            if (continueUrl) {
              console.log("[AI Job Apply] Handling profile resume page. Looking for continue button...");
              setTimeout(() => {
                const continueBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
                  const text = el.innerText.toLowerCase();
                  return text.includes("continue") || text.includes("save") || text.includes("apply") || text.includes("back to");
                });
                
                if (continueBtn) {
                  console.log("[AI Job Apply] Clicking profile continue button...");
                  continueBtn.click();
                } else {
                  console.log("[AI Job Apply] Continue button not found, redirecting directly to:", continueUrl);
                  window.location.href = continueUrl;
                }
              }, 1500);
            }
            return;
          }

          // Execute auto-apply flow directly in this tab
          ActiveConnector.EasyApply.automate(
            profile, 
            (msg) => console.log("[AI Job Apply]", msg), 
            () => isContextValid(), 
            jobId
          );
        })
        .catch(err => {
          console.error("[AI Job Apply] Active profile fetch failed:", err);
        });
      });
      return;
    }

    // Check if this is a sub-tab opened during an automated apply session that has redirected to a non-apply page
    chrome.runtime.sendMessage({ action: "checkTabRole" }, (role) => {
      if (!isContextValid()) return;
      const isMaster = role && role.isMaster;
      const turboModeActive = role && role.turboModeActive;
      
      chrome.storage.local.get(["currently_applying_job_id"], (data) => {
        if (!isContextValid()) return;
        const activeJobId = data.currently_applying_job_id;
        if (activeJobId) {
          chrome.storage.local.get([`retry_apply_active_${activeJobId}`], (res) => {
            if (!isContextValid()) return;
            const isRetry = res[`retry_apply_active_${activeJobId}`];
            const isAutomated = turboModeActive || isRetry;
            
            // Indeed specific closing behavior
            if (window.location.hostname.includes("indeed.com")) {
              const isApplyStart = window.location.href.includes("jk=") || window.location.href.includes("applystart");
              if (isAutomated && !isMaster && !turboRunning && !isApplyStart) {
                console.log("[AI Job Apply] Sub-tab redirected away from apply flow. Closing tab.");
                chrome.storage.local.set({
                  [`indeed_apply_status_${activeJobId}`]: "failed",
                  [`retry_apply_status_${activeJobId}`]: "failed"
                }, () => {
                  window.close();
                });
                return;
              }
            }
            
            // Otherwise proceed to normal scraper
            continueScraperSetup(role);
          });
        } else {
          continueScraperSetup(role);
        }
      });
    });

    function continueScraperSetup(role = null) {
      const isRetrySub = role && role.isRetrySub;
      if (isRetrySub) {
        chrome.storage.local.get(["currently_applying_job_id"], (data) => {
          if (!isContextValid()) return;
          const activeJobId = data.currently_applying_job_id;
          if (activeJobId) {
            chrome.storage.local.get([`retry_apply_active_${activeJobId}`], (res) => {
              if (!isContextValid()) return;
              if (res[`retry_apply_active_${activeJobId}`]) {
                console.log("[AI Job Apply] Detected active retry for Job ID in retry sub-tab:", activeJobId);
                runRetryAutoApply(activeJobId);
              } else {
                startRegularScraper();
              }
            });
          } else {
            startRegularScraper();
          }
        });
      } else {
        startRegularScraper();
      }
    }

    function startRegularScraper() {
      if (window.location.hostname.includes("greenhouse.io")) {
        if (!shadowRoot) {
          activeJobId = ActiveConnector.getJobId() || "greenhouse-dashboard";
          scrapeAndShowWidget();
        }
      }

      scraperInterval = setInterval(() => {
        if (!isContextValid()) {
          if (scraperInterval) clearInterval(scraperInterval);
          return;
        }

        if (turboRunning) return;
        
        const jobId = ActiveConnector.getJobId();
        if (jobId && jobId !== activeJobId) {
          activeJobId = jobId;
          
          if (scrapeTimeout) clearTimeout(scrapeTimeout);
          
          if (shadowRoot) {
            shadowRoot.querySelector("#ext-job-title").innerText = "Loading details...";
            shadowRoot.querySelector("#ext-job-company").innerText = "-";
            shadowRoot.querySelector("#ext-job-location").innerText = "-";
          }

          scrapeTimeout = setTimeout(() => {
            if (!isContextValid()) return;
            scrapeAndShowWidget();
          }, 1200);
        } else if (!jobId && window.location.hostname.includes("greenhouse.io") && !shadowRoot) {
          activeJobId = "greenhouse-dashboard";
          scrapeAndShowWidget();
        }
      }, 1500);
    }
  };

  const scrapeAndShowWidget = () => {
    currentJobData = ActiveConnector.scrapeDetails(activeJobId);
    if (!shadowRoot) {
      injectShadowDOM();
    }
    updateWidgetUI();
  };

  // Setup Shadow DOM container to prevent LinkedIn style pollution
  const injectShadowDOM = () => {
    const container = document.createElement("div");
    container.id = "ai-job-apply-extension-root";
    container.style.position = "fixed";
    container.style.bottom = "24px";
    container.style.right = "24px";
    container.style.zIndex = "2147483647";
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: "open" });
    shadowRoot = shadow;

    // Load styles inside Shadow DOM - System Font Stack to avoid CSP blocking
    const style = document.createElement("style");
    style.textContent = `
      :host {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      /* Floating Trigger Button */
      .trigger-btn {
        width: 56px;
        height: 56px;
        border-radius: 28px;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: white;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }

      .trigger-btn:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
      }

      /* Drawer Container */
      .drawer {
        position: fixed;
        right: -420px;
        bottom: 0;
        top: 0;
        width: 380px;
        background: rgba(10, 10, 15, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-left: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
        transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        padding: 24px;
        color: white;
        z-index: 2147483646;
      }

      .drawer.open {
        right: 0;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 16px;
        margin-bottom: 16px;
      }

      .title {
        font-size: 18px;
        font-weight: 700;
        background: linear-gradient(to right, #ffffff, #a5b4fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 20px;
        cursor: pointer;
        transition: color 0.2s;
        padding: 4px;
      }

      .close-btn:hover {
        color: white;
      }

      /* Tabs */
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        padding-bottom: 8px;
      }

      .tab-btn {
        flex: 1;
        background: transparent;
        border: 1px solid transparent;
        color: rgba(255, 255, 255, 0.4);
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        padding: 6px 0;
        border-radius: 8px;
        transition: all 0.2s;
      }

      .tab-btn.active {
        background: rgba(99, 102, 241, 0.15);
        color: white;
        border: 1px solid rgba(99, 102, 241, 0.25);
      }

      /* Status Badge */
      .badge {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 4px 10px;
        border-radius: 20px;
        align-self: flex-start;
        margin-bottom: 16px;
      }

      .badge.connected {
        background: rgba(16, 185, 129, 0.1);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.2);
      }

      .badge.disconnected {
        background: rgba(239, 68, 68, 0.1);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.2);
      }

      /* Scrollable Body */
      .body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-right: 4px;
      }

      /* Custom scrollbar */
      .body::-webkit-scrollbar {
        width: 5px;
      }
      .body::-webkit-scrollbar-track {
        background: transparent;
      }
      .body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }

      /* Job Info Card */
      .job-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 14px;
        padding: 16px;
        position: relative;
      }

      .job-title {
        font-size: 15px;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
      }

      .job-company {
        font-size: 13px;
        color: #818cf8;
        font-weight: 500;
      }

      .job-meta {
        font-size: 11px;
        color: #908fa0;
        margin-top: 8px;
        display: flex;
        justify-content: space-between;
      }

      .sync-link {
        font-size: 10px;
        color: #6366f1;
        text-decoration: underline;
        cursor: pointer;
        float: right;
        margin-top: 4px;
      }
      
      .sync-link:hover {
        color: #a5b4fc;
      }

      /* Form controls */
      .btn {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: white;
        border-radius: 12px;
        padding: 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      }

      .btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(79, 70, 229, 0.5);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn.danger {
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
      .btn.danger:hover {
        box-shadow: 0 6px 18px rgba(239, 68, 68, 0.5);
      }

      .btn.secondary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: none;
      }

      .btn.secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      /* Cover Letter Block */
      .letter-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }

      .letter-area {
        width: 100%;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 12px;
        color: #a5b4fc;
        font-size: 12px;
        line-height: 1.6;
        font-family: monospace;
        resize: vertical;
        min-height: 200px;
        outline: none;
      }

      .letter-area:focus {
        border-color: #6366f1;
      }

      /* Console box for Turbo Mode */
      .console-log {
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 10px;
        font-family: monospace;
        font-size: 11px;
        color: #34d399;
        height: 140px;
        overflow-y: auto;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      /* Loading Animation */
      .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    shadow.appendChild(style);

    // Create trigger button
    const trigger = document.createElement("div");
    trigger.className = "trigger-btn";
    trigger.innerHTML = "AI";
    trigger.addEventListener("click", () => {
      drawer.classList.toggle("open");
      if (!turboRunning && isContextValid()) {
        scrapeAndShowWidget();
      }
    });
    shadow.appendChild(trigger);

    // Create drawer
    const drawer = document.createElement("div");
    drawer.className = "drawer";
    drawer.innerHTML = `
      <div class="header">
        <span class="title">AI Job Apply</span>
        <button class="close-btn">&times;</button>
      </div>
      <div id="connection-status" class="badge disconnected">Checking Connection...</div>
      
      <!-- Tab Controls -->
      <div class="tabs">
        <button class="tab-btn active" id="tab-btn-single">Single Apply</button>
        <button class="tab-btn" id="tab-btn-turbo">Turbo Mode</button>
      </div>

      <div class="body">
        <!-- Tab 1: Single Apply -->
        <div id="panel-single">
          <div class="job-card" style="margin-bottom: 16px;">
            <span class="sync-link" id="btn-sync-details">Sync Details</span>
            <div class="job-title" id="ext-job-title">-</div>
            <div class="job-company" id="ext-job-company">-</div>
            <div class="job-meta">
              <span id="ext-job-location">-</span>
              <span id="ext-job-platform">LinkedIn</span>
            </div>
          </div>

          <div id="active-profile-card" style="font-size: 12px; color: #a5b4fc; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 10px; padding: 12px; margin-bottom: 16px; display: none;">
            Active Profile: <strong id="active-profile-name">-</strong>
          </div>

          <button class="btn" id="btn-autofill-job" style="width: 100%; margin-bottom: 12px; display: none;">
            <span>Auto Fill Application</span>
          </button>

          <button class="btn" id="btn-save-job" style="width: 100%;" disabled>
            <span>Save Job & Tailor Letter</span>
          </button>

          <div class="letter-container" id="letter-container" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #908fa0;">Tailored Cover Letter</label>
              <button class="btn secondary" id="btn-copy-letter" style="padding: 4px 8px; font-size: 10px; border-radius: 6px; box-shadow: none;">Copy</button>
            </div>
            <textarea class="letter-area" id="letter-content" readonly></textarea>
          </div>
        </div>

        <!-- Tab 2: Turbo Mode -->
        <div id="panel-turbo" style="display: none;">
          <div id="kb-warning-alert" style="display: none; font-size: 11px; color: #f87171; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 12px; margin-bottom: 16px; line-height: 1.4;">
            <strong>Knowledge Graph Gaps:</strong> You have some unanswered questions in your profile.
            <br/><br/>
            <a href="http://localhost:5173/profile" target="_blank" style="color: #ef4444; text-decoration: underline; font-weight: bold;">Update Knowledgebase Page</a>
          </div>

          <div style="font-size: 12px; color: #a5b4fc; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 10px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span>Batch Limit:</span>
              <select id="turbo-limit" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 2px 6px; outline: none; font-family: inherit;">
                <option value="10" selected>10 Jobs</option>
                <option value="20">20 Jobs</option>
                <option value="50">50 Jobs</option>
                <option value="100">100 Jobs</option>
              </select>
            </div>
            <div style="font-size: 10px; color: #908fa0; line-height: 1.4;">
              Turbo Mode automates clicking through your current job search list, auto-fills standard apply dialogs, and auto-syncs applications to your dashboard.
            </div>
          </div>

          <button class="btn" id="btn-start-turbo" style="width: 100%; margin-bottom: 16px;" disabled>
            <span>Start Turbo Apply</span>
          </button>
          
          <div id="turbo-console-container" style="display: none;">
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #908fa0; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>Turbo Log</span>
              <span id="turbo-progress">0/10</span>
            </div>
            <div class="console-log" id="turbo-console"></div>
          </div>
        </div>
      </div>
    `;

    drawer.querySelector(".close-btn").addEventListener("click", () => {
      drawer.classList.remove("open");
    });

    shadow.appendChild(drawer);

    // Tab Switching
    const tabSingle = shadowRoot.querySelector("#tab-btn-single");
    const tabTurbo = shadowRoot.querySelector("#tab-btn-turbo");
    const panelSingle = shadowRoot.querySelector("#panel-single");
    const panelTurbo = shadowRoot.querySelector("#panel-turbo");

    tabSingle.addEventListener("click", () => {
      if (turboRunning) return;
      tabSingle.classList.add("active");
      tabTurbo.classList.remove("active");
      panelSingle.style.display = "block";
      panelTurbo.style.display = "none";
      if (isContextValid()) scrapeAndShowWidget();
    });

    tabTurbo.addEventListener("click", () => {
      tabSingle.classList.remove("active");
      tabTurbo.classList.add("active");
      panelSingle.style.display = "none";
      panelTurbo.style.display = "block";
      pollUnansweredQuestions();
    });

    // Bind event handlers
    const saveBtn = drawer.querySelector("#btn-save-job");
    saveBtn.addEventListener("click", () => {
      saveJobAndTailor();
    });

    const autofillBtn = drawer.querySelector("#btn-autofill-job");
    autofillBtn.addEventListener("click", async () => {
      const profileJsonStr = autofillBtn.dataset.profileJson;
      if (!profileJsonStr) return;
      const profile = JSON.parse(profileJsonStr);

      autofillBtn.disabled = true;
      autofillBtn.innerHTML = "<span>Auto Filling...</span>";

      const jobId = ActiveConnector.getJobId();
      const fillSuccess = await ActiveConnector.EasyApply.automate(
        profile,
        (msg) => console.log("[AI Job Apply Single]", msg),
        () => isContextValid(),
        jobId
      );

      autofillBtn.disabled = false;
      if (fillSuccess) {
        autofillBtn.innerHTML = "<span>Form Filled!</span>";
        autofillBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        setTimeout(() => {
          autofillBtn.innerHTML = "<span>Auto Fill Application</span>";
          autofillBtn.style.background = "";
        }, 3000);
      } else {
        autofillBtn.innerHTML = "<span>Fill Skipped/Failed</span>";
        setTimeout(() => {
          autofillBtn.innerHTML = "<span>Auto Fill Application</span>";
        }, 3000);
      }
    });

    const syncLink = drawer.querySelector("#btn-sync-details");
    syncLink.addEventListener("click", () => {
      if (isContextValid()) scrapeAndShowWidget();
    });

    const copyBtn = drawer.querySelector("#btn-copy-letter");
    copyBtn.addEventListener("click", () => {
      const txt = drawer.querySelector("#letter-content");
      txt.select();
      navigator.clipboard.writeText(txt.value).then(() => {
        const orig = copyBtn.innerText;
        copyBtn.innerText = "Copied!";
        setTimeout(() => { copyBtn.innerText = orig; }, 1500);
      });
    });

    // Turbo Mode toggle button
    const turboBtn = drawer.querySelector("#btn-start-turbo");
    turboBtn.addEventListener("click", () => {
      if (turboRunning) {
        stopTurboApply();
      } else {
        startTurboApply();
      }
    });
  };

  const updateJobStatusInBackend = (jobDbId, status) => {
    return new Promise((resolve, reject) => {
      if (!isContextValid()) return reject(new Error("Context invalidated"));

      chrome.storage.local.get(["token", "apiUrl"], (data) => {
        if (!isContextValid()) return reject(new Error("Context invalidated"));
        let api = data.apiUrl || API_DEFAULT_URL;
        if (api === "undefined" || api === "null") api = API_DEFAULT_URL;
        const token = data.token;
        if (!token) return reject(new Error("No credentials token"));

        fetchBackend(`${api}/api/jobs/${jobDbId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ status: status })
        })
        .then(res => resolve(res))
        .catch(err => reject(err));
      });
    });
  };

  const pollUnansweredQuestions = () => {
    if (!shadowRoot || !isContextValid()) return;

    chrome.storage.local.get(["token", "apiUrl"], (data) => {
      if (!isContextValid()) return;
      let api = data.apiUrl || API_DEFAULT_URL;
      if (api === "undefined" || api === "null") api = API_DEFAULT_URL;
      const token = data.token;

      if (!token) return;

      fetchBackend(`${api}/api/profiles/knowledgebase/unanswered`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(unanswered => {
        if (!isContextValid()) return;
        const alertBox = shadowRoot.querySelector("#kb-warning-alert");
        const turboBtn = shadowRoot.querySelector("#btn-start-turbo");

        if (unanswered && unanswered.length > 0) {
          alertBox.innerHTML = `
            <strong>Knowledge Graph Gaps:</strong> You have ${unanswered.length} unanswered questions in your profile knowledgebase.
            <br/><br/>
            <a href="http://localhost:5173/profile" target="_blank" style="color: #ef4444; text-decoration: underline; font-weight: bold;">Update Knowledgebase Page</a>
          `;
          alertBox.style.display = "block";
          turboBtn.disabled = true;
          turboBtn.innerHTML = "<span>Resolve Gaps to Start Turbo</span>";
        } else {
          alertBox.style.display = "none";
          turboBtn.disabled = false;
          if (!turboRunning) {
            turboBtn.innerHTML = "<span>Launch Turbo Mode</span>";
          }
        }
      })
      .catch(err => {
        console.error("[AI Job Apply Extension] Error polling unanswered questions:", err);
      });
    });
  };

  const runRetryAutoApply = async (activeJobId) => {
    console.log("[AI Job Apply] runRetryAutoApply starting for", activeJobId);
    await sleep(2500);

    const isSmartApply = window.location.hostname.includes("smartapply.indeed.com");
    if (isSmartApply) {
      return;
    }

    chrome.storage.local.get(["token", "apiUrl"], (data) => {
      if (!isContextValid()) return;
      const api = data.apiUrl || API_DEFAULT_URL;
      const token = data.token;
      if (!token) return;

      fetchBackend(`${api}/api/profiles/active`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(async (profile) => {
        if (!isContextValid()) return;

        if (ActiveConnector.isAlreadyApplied && ActiveConnector.isAlreadyApplied()) {
          console.log("[AI Job Apply] Job already applied on platform. Updating status to success.");
          chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "success" });
          window.close();
          return;
        }

        const easyApplyBtn = ActiveConnector.getEasyApplyButton();
        if (!easyApplyBtn) {
          console.log("[AI Job Apply] Easy Apply button not found on retry page.");
          chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "failed" });
          window.close();
          return;
        }

        console.log("[AI Job Apply] Click Easy Apply button");
        window.clickElement(easyApplyBtn);
        await sleep(1500);

        if (ActiveConnector.name === "Indeed") {
          let status = "running";
          for (let i = 0; i < 75; i++) {
            if (!isContextValid()) return;
            const statusData = await new Promise(r => chrome.storage.local.get([`indeed_apply_status_${activeJobId}`], r));
            status = statusData[`indeed_apply_status_${activeJobId}`];
            if (status === "success") {
              chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "success" });
              window.close();
              return;
            } else if (status === "failed") {
              chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "failed" });
              window.close();
              return;
            } else {
              const qData = await new Promise(r => chrome.storage.local.get([`indeed_outstanding_questions_${activeJobId}`], r));
              if (qData[`indeed_outstanding_questions_${activeJobId}`]) {
                chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "needs-knowledge-graph" });
                window.close();
                return;
              }
            }
            await sleep(1000);
          }
          chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "failed" });
          window.close();
        } else {
          const fillSuccess = await ActiveConnector.EasyApply.automate(
            profile,
            (msg) => console.log("[AI Job Apply Retry]", msg),
            () => isContextValid(),
            activeJobId
          );

          if (!isContextValid()) return;

          if (fillSuccess) {
            chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "success" });
          } else {
            const qData = await new Promise(r => chrome.storage.local.get([`retry_outstanding_questions_${activeJobId}`], r));
            if (qData[`retry_outstanding_questions_${activeJobId}`]) {
              chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "needs-knowledge-graph" });
            } else {
              chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "failed" });
            }
          }
          await sleep(1500);
          window.close();
        }
      });
    });
  };

  // Populate dynamic job details into the UI
  const updateWidgetUI = () => {
    if (!shadowRoot || !isContextValid()) return;
    
    if (currentJobData) {
      shadowRoot.querySelector("#ext-job-title").innerText = currentJobData.title;
      shadowRoot.querySelector("#ext-job-company").innerText = currentJobData.company_name;
      shadowRoot.querySelector("#ext-job-location").innerText = currentJobData.location;
      const platformEl = shadowRoot.querySelector("#ext-job-platform");
      if (platformEl) platformEl.innerText = ActiveConnector.name;
    }

    try {
      // Check backend auth
      chrome.storage.local.get(["token", "apiUrl"], (data) => {
        if (!isContextValid()) return;

        const statusBadge = shadowRoot.querySelector("#connection-status");
        const saveBtn = shadowRoot.querySelector("#btn-save-job");
        const autofillBtn = shadowRoot.querySelector("#btn-autofill-job");
        const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
        const profileCard = shadowRoot.querySelector("#active-profile-card");
        const profileName = shadowRoot.querySelector("#active-profile-name");

        // Normalize URL string values
        let api = data.apiUrl || API_DEFAULT_URL;
        if (api === "undefined" || api === "null") {
          api = API_DEFAULT_URL;
        }
        const token = data.token;

        if (!token) {
          statusBadge.className = "badge disconnected";
          statusBadge.innerText = "Disconnected";
          saveBtn.disabled = true;
          saveBtn.innerHTML = "<span>Please Login in Dashboard</span>";
          autofillBtn.style.display = "none";
          turboBtn.disabled = true;
          turboBtn.innerHTML = "<span>Please Login in Dashboard</span>";
          profileCard.style.display = "none";
          return;
        }

        // Fetch active profile from backend via proxy
        fetchBackend(`${api}/api/profiles/active`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
        .then(profile => {
          if (!isContextValid()) return;

          statusBadge.className = "badge connected";
          statusBadge.innerText = "Connected";
          
          saveBtn.disabled = false;
          saveBtn.innerHTML = "<span>Save Job & Tailor Letter</span>";
          
          const panelTurbo = shadowRoot.querySelector("#panel-turbo");
          if (panelTurbo && panelTurbo.style.display === "block") {
            pollUnansweredQuestions();
          } else {
            turboBtn.disabled = false;
            if (!turboRunning) {
              turboBtn.innerHTML = "<span>Launch Turbo Mode</span>";
            }
          }
          
          profileCard.style.display = "block";
          profileName.innerText = profile.title;
          
          saveBtn.dataset.profileId = profile.id;
          autofillBtn.dataset.profileJson = JSON.stringify(profile);
          turboBtn.dataset.profileId = profile.id;
          turboBtn.dataset.profileJson = JSON.stringify(profile);

          // Show Auto Fill button if Easy Apply is available
          const hasEasyApply = ActiveConnector.getEasyApplyButton && ActiveConnector.getEasyApplyButton();
          const isGreenhouse = window.location.hostname.includes("greenhouse.io") && !window.location.href.includes("my.greenhouse.io/dashboard");
          if (hasEasyApply || isGreenhouse) {
            autofillBtn.style.display = "block";
          } else {
            autofillBtn.style.display = "none";
          }
        })
        .catch(err => {
          if (!isContextValid()) return;
          console.error("[AI Job Apply Extension] active profile verification failed:", err);
          statusBadge.className = "badge disconnected";
          statusBadge.innerText = "Session Expired";
          saveBtn.disabled = true;
          saveBtn.innerHTML = "<span>Log in on localhost:5173</span>";
          autofillBtn.style.display = "none";
          turboBtn.disabled = true;
          turboBtn.innerHTML = "<span>Log in on localhost:5173</span>";
          profileCard.style.display = "none";
        });
      });
    } catch (e) {
      console.warn("[AI Job Apply Extension] UI update skipped due to invalid context:", e);
    }
  };

  // Perform backend operations for a single job
  const saveJobAndTailor = () => {
    if (!shadowRoot || !currentJobData || !isContextValid()) return;

    const saveBtn = shadowRoot.querySelector("#btn-save-job");
    const profileId = saveBtn.dataset.profileId;
    
    try {
      chrome.storage.local.get(["token", "apiUrl"], (data) => {
        if (!isContextValid()) return;

        let api = data.apiUrl || API_DEFAULT_URL;
        if (api === "undefined" || api === "null") {
          api = API_DEFAULT_URL;
        }
        const token = data.token;

        if (!token || !profileId) return;

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<div class="spinner"></div> <span>Saving Job...</span>`;

        const jobPayload = {
          platform_name: currentJobData.platform_name,
          title: currentJobData.title,
          company_name: currentJobData.company_name,
          location: currentJobData.location,
          job_url: currentJobData.job_url,
          status: "Applied",
          job_profile_id: parseInt(profileId),
          applied_date: new Date().toISOString().split("T")[0]
        };

        fetchBackend(`${api}/api/jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(jobPayload)
        })
        .then(savedJob => {
          if (!isContextValid()) return;
          saveBtn.innerHTML = `<div class="spinner"></div> <span>Tailoring Cover Letter...</span>`;
          return fetchBackend(`${api}/api/jobs/${savedJob.id}/tailor`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              job_profile_id: parseInt(profileId),
              job_description: currentJobData.job_description
            })
          });
        })
        .then(coverLetter => {
          if (!isContextValid()) return;
          saveBtn.innerHTML = "<span>Success! Saved to Board</span>";
          saveBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
          
          const letterContainer = shadowRoot.querySelector("#letter-container");
          const letterText = shadowRoot.querySelector("#letter-content");
          letterContainer.style.display = "flex";
          letterText.value = coverLetter.content;
        })
        .catch(err => {
          if (!isContextValid()) return;
          alert("Error during automation: " + err.message);
          updateWidgetUI();
        });
      });
    } catch (e) {
      console.error("[AI Job Apply Extension] Single apply failed (context invalidated):", e);
    }
  };

  const resumeGreenhouseTurboMode = async (state) => {
    turboRunning = true;
    
    // Inject Shadow DOM and show Turbo Panel
    if (!shadowRoot) {
      injectShadowDOM();
    }
    
    const tabDetails = shadowRoot.querySelector("#tab-btn-details");
    const tabTurbo = shadowRoot.querySelector("#tab-btn-turbo");
    const panelDetails = shadowRoot.querySelector("#panel-details");
    const panelTurbo = shadowRoot.querySelector("#panel-turbo");
    
    if (tabDetails) tabDetails.classList.remove("active");
    if (tabTurbo) tabTurbo.classList.add("active");
    if (panelDetails) panelDetails.style.display = "none";
    if (panelTurbo) panelTurbo.style.display = "block";
    
    const consoleContainer = shadowRoot.querySelector("#turbo-console-container");
    const consoleBox = shadowRoot.querySelector("#turbo-console");
    const progressSpan = shadowRoot.querySelector("#turbo-progress");
    const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
    
    if (consoleContainer) consoleContainer.style.display = "block";
    if (progressSpan) progressSpan.innerText = `${state.applied_count}/${state.limit}`;
    if (turboBtn) {
      turboBtn.classList.add("danger");
      turboBtn.innerHTML = "<span>Stop Turbo Mode</span>";
      turboBtn.dataset.profileJson = state.profile_json;
    }
    
    const logMessage = (msg, level = "INFO") => {
      const timestamp = new Date().toLocaleTimeString();
      if (consoleBox) {
        consoleBox.innerHTML += `[${timestamp}] ${msg}\n`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
      }
      
      try {
        const currentJobId = ActiveConnector.getJobId();
        remoteLog(level, msg, currentJobId);
      } catch (err) {
        console.warn("[AI Job Apply] Error sending remote log:", err);
      }
    };
    
    logMessage(`Resuming Turbo Mode progress: ${state.applied_count}/${state.limit}...`);
    
    const currentUrl = window.location.href;
    const isConfirmationPage = currentUrl.includes("/confirmation");
    
    const storage = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
    const token = storage.token;
    const api = storage.apiUrl || API_DEFAULT_URL;
    
    if (isConfirmationPage) {
      logMessage("Confirmation page detected! Job application submitted successfully.");
      
      state.applied_count++;
      state.current_index++;
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
      return;
    }
    
    const jobId = ActiveConnector.getJobId();
    if (!jobId) {
      logMessage("Could not retrieve Job ID on current page. Skipping to next job...");
      state.current_index++;
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
      return;
    }
    
    const jobData = ActiveConnector.scrapeDetails(jobId);
    logMessage(`Loaded job: "${jobData.title}" at "${jobData.company_name}"`);
    
    if (ActiveConnector.isAlreadyApplied && ActiveConnector.isAlreadyApplied()) {
      logMessage("Job already marked as 'Applied' on platform. Skipping...");
      state.applied_count++;
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {
        logMessage(`Database sync failed: ${err.message}`);
      }
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
      return;
    }
    
    const easyApplyBtn = ActiveConnector.getEasyApplyButton();
    if (!easyApplyBtn) {
      logMessage("No application form or Easy Apply button available. Skipping...");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
      return;
    }
    
    logMessage("Automating form fill...");
    const fillSuccess = await ActiveConnector.EasyApply.automate(
      JSON.parse(state.profile_json),
      logMessage,
      () => turboRunning && isContextValid()
    );
    
    if (!fillSuccess) {
      logMessage("Application failed, timed out, or was skipped.");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
        logMessage("Saved to database with status 'needs-knowledge-graph'.");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
    } else {
      logMessage("Application submitted! Syncing details to database...");
      state.applied_count++;
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: state }, r));
      navigateToNextTurboJob(state, logMessage);
    }
  };
  
  const navigateToNextTurboJob = async (state, logMessage) => {
    if (state.applied_count >= state.limit || state.current_index >= state.job_urls.length) {
      logMessage(`Turbo run finished! Applied to ${state.applied_count}/${state.limit} jobs.`);
      
      await new Promise(r => chrome.storage.local.remove(["greenhouse_turbo_state"], r));
      turboRunning = false;
      
      const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
      if (turboBtn) {
        turboBtn.classList.remove("danger");
        turboBtn.innerHTML = "<span>Turbo Run Complete!</span>";
        setTimeout(() => {
          turboBtn.innerHTML = "<span>Launch Turbo Mode</span>";
        }, 3000);
      }
      
      logMessage("Navigating back to main jobs listing...");
      await sleep(2500);
      window.location.href = state.listing_page_url;
      return;
    }
    
    const nextUrl = state.job_urls[state.current_index];
    logMessage(`Navigating to next job URL in 3 seconds: ${nextUrl}`);
    await sleep(3000);
    window.location.href = nextUrl;
  };

  // ==========================================
  // 4. TURBO MODE AUTOMATION ENGINE
  // ==========================================
  const startTurboApply = async () => {
    if (!isContextValid()) return;
    
    const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
    const profileJsonStr = turboBtn.dataset.profileJson;
    if (!profileJsonStr) return;

    const profile = JSON.parse(profileJsonStr);
    const limitSelect = shadowRoot.querySelector("#turbo-limit");
    const limit = parseInt(limitSelect.value);

    turboRunning = true;
    chrome.runtime.sendMessage({ action: "setMasterTab" });
    turboBtn.classList.add("danger");
    turboBtn.innerHTML = "<span>Stop Turbo Mode</span>";
    chrome.storage.local.set({ turbo_mode_active: true });
    
    // Clear and show console
    const consoleContainer = shadowRoot.querySelector("#turbo-console-container");
    const consoleBox = shadowRoot.querySelector("#turbo-console");
    const progressSpan = shadowRoot.querySelector("#turbo-progress");
    
    consoleContainer.style.display = "block";
    consoleBox.innerHTML = "";
    progressSpan.innerText = `0/${limit}`;

    const logMessage = (msg, level = "INFO") => {
      const timestamp = new Date().toLocaleTimeString();
      consoleBox.innerHTML += `[${timestamp}] ${msg}\n`;
      consoleBox.scrollTop = consoleBox.scrollHeight;
      
      try {
        const currentJobId = ActiveConnector.getJobId();
        remoteLog(level, msg, currentJobId);
      } catch (err) {
        console.warn("[AI Job Apply] Error sending remote log:", err);
      }
    };


    logMessage("Initializing Turbo Mode...");

    if (window.location.hostname.includes("greenhouse.io")) {
      const jobCards = ActiveConnector.getJobCards();
      if (jobCards.length === 0) {
        logMessage("No job listings detected in the search list!");
        stopTurboApply();
        return;
      }
      
      const jobUrls = jobCards.map(card => {
        const link = card.querySelector("a[href*='/jobs/']") || (card.tagName === "A" && card.href.includes("/jobs/") ? card : null);
        return link ? link.href : null;
      }).filter(url => url !== null);
      
      if (jobUrls.length === 0) {
        logMessage("No job application URLs found in listing cards!");
        stopTurboApply();
        return;
      }
      
      logMessage(`Found ${jobUrls.length} job URLs. Initializing Greenhouse Multi-Job Turbo Mode...`);
      
      const greenhouse_turbo_state = {
        active: true,
        profile_id: profile.id,
        profile_json: profileJsonStr,
        limit: limit,
        applied_count: 0,
        listing_page_url: window.location.href,
        job_urls: jobUrls,
        current_index: 0,
        status: "navigating_to_job"
      };
      
      await new Promise(r => chrome.storage.local.set({ greenhouse_turbo_state: greenhouse_turbo_state }, r));
      logMessage(`Navigating to first job URL in 1.5 seconds: ${jobUrls[0]}`);
      await sleep(1500);
      window.location.href = jobUrls[0];
      return;
    }

    // retry phase: check database for retryable jobs with status 'needs-knowledge-graph'
    try {
      logMessage("Checking database for retryable jobs with status 'needs-knowledge-graph'...");
      const allJobs = await new Promise((resolve, reject) => {
        chrome.storage.local.get(["token", "apiUrl"], (data) => {
          if (!isContextValid()) return reject(new Error("Context invalidated"));
          let api = data.apiUrl || API_DEFAULT_URL;
          if (api === "undefined" || api === "null") api = API_DEFAULT_URL;
          const token = data.token;
          if (!token) return reject(new Error("No credentials token"));
          
          fetchBackend(`${api}/api/jobs`, {
            headers: { "Authorization": `Bearer ${token}` }
          })
          .then(resolve)
          .catch(reject);
        });
      });
      
      const retryJobs = allJobs.filter(j => 
        j.status === 'needs-knowledge-graph' && 
        j.platform_name && 
        j.platform_name.toLowerCase() === ActiveConnector.name.toLowerCase()
      );
      if (retryJobs.length > 0) {
        logMessage(`Found ${retryJobs.length} jobs with status 'needs-knowledge-graph'. Retrying...`);
        for (const job of retryJobs) {
          if (!turboRunning || !isContextValid()) break;
          
          logMessage(`Retrying job: "${job.title}" at "${job.company_name}"...`);
          
          // Clear any previous status
          await new Promise(r => {
            chrome.storage.local.remove([
              `retry_apply_status_${job.id}`,
              `retry_outstanding_questions_${job.id}`,
              `indeed_apply_status_${job.id}`,
              `indeed_outstanding_questions_${job.id}`
            ], r);
          });
          
          // Set retry flag & job id in storage
          await new Promise(r => {
            chrome.storage.local.set({
              currently_applying_job_id: job.id,
              [`retry_apply_active_${job.id}`]: true
            }, r);
          });
          
          // Open job url in new tab
          logMessage(`Opening job URL: ${job.job_url}`);
          const openResponse = await new Promise(r => {
            chrome.runtime.sendMessage({ action: "openTab", url: job.job_url }, r);
          });
          
          if (!openResponse || !openResponse.success) {
            logMessage(`Failed to open URL for retry: ${job.job_url}`);
            continue;
          }
          
          // Monitor retry status
          let retryStatus = "running";
          // Wait up to 90 seconds
          for (let s = 0; s < 90; s++) {
            if (!turboRunning || !isContextValid()) break;
            
            const statusData = await new Promise(r => {
              chrome.storage.local.get([`retry_apply_status_${job.id}`], r);
            });
            retryStatus = statusData[`retry_apply_status_${job.id}`];
            if (retryStatus === "success") {
              logMessage(`Retry success! Updating database status to 'Applied'...`);
              await updateJobStatusInBackend(job.id, "Applied");
              break;
            } else if (retryStatus === "needs-knowledge-graph") {
              logMessage(`Retry encountered unanswered questions again. Kept status as 'needs-knowledge-graph'.`);
              break;
            } else if (retryStatus === "failed") {
              logMessage(`Retry failed. Keeping status as 'needs-knowledge-graph' for future retry.`);
              break;
            }
            await sleep(1000);
          }
          
          // Clean up storage
          await new Promise(r => {
            chrome.storage.local.remove([
              `retry_apply_active_${job.id}`,
              `retry_apply_status_${job.id}`,
              `retry_outstanding_questions_${job.id}`,
              `indeed_apply_status_${job.id}`,
              `indeed_outstanding_questions_${job.id}`
            ], r);
          });
          
          await sleep(2000);
        }
      } else {
        logMessage("No jobs with status 'needs-knowledge-graph' found.");
      }
    } catch (retryErr) {
      logMessage(`Error during retry phase: ${retryErr.message}`);
    }

    // Fetch list items
    const jobCards = ActiveConnector.getJobCards();
    if (jobCards.length === 0) {
      logMessage(`No job listings detected in the search list! Make sure you are on a ${ActiveConnector.name} jobs search page.`);
      stopTurboApply();
      return;
    }

    logMessage(`Found ${jobCards.length} job cards on current search pane.`);
    let appliedCount = 0;

    for (let i = 0; i < jobCards.length; i++) {
      if (!turboRunning || !isContextValid()) {
        logMessage("Turbo Mode paused/stopped.");
        break;
      }

      if (appliedCount >= limit) {
        logMessage(`Batch limit of ${limit} reached successfully!`);
        break;
      }

      const card = jobCards[i];
      logMessage(`--- Job Item ${i + 1}/${jobCards.length} ---`);
      
      const cardDetails = ActiveConnector.scrapeCardDetails(card);
      
      try {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) {
        console.warn("[AI Job Apply] scrollIntoView failed:", e);
      }
      await sleep(800);
      
      ActiveConnector.clickJobCard(card);
      logMessage("Clicked job card. Waiting for details to load...");
      await sleep(2500);

      if (!isContextValid()) break;

      const jobId = ActiveConnector.getJobId();
      if (!jobId) {
        logMessage("Could not retrieve Job ID. Skipping...");
        continue;
      }

      const jobData = ActiveConnector.scrapeDetails(jobId);
      
      if (cardDetails) {
        if (jobData.title === "Unknown Position" && cardDetails.title !== "Unknown Position") {
          jobData.title = cardDetails.title;
        }
        if (jobData.company_name === "Unknown Company" && cardDetails.company !== "Unknown Company") {
          jobData.company_name = cardDetails.company;
        }
        if (jobData.location === "Unknown Location" && cardDetails.location !== "Unknown Location") {
          jobData.location = cardDetails.location;
        }
      }
      
      logMessage(`Loaded: "${jobData.title}" at "${jobData.company_name}"`);

      if (ActiveConnector.isAlreadyApplied && ActiveConnector.isAlreadyApplied()) {
        logMessage("Job already marked as 'Applied' on platform. Syncing status...");
        appliedCount++;
        progressSpan.innerText = `${appliedCount}/${limit}`;
        try {
          await syncJobToBackend(jobData, profile.id, "Applied");
          logMessage("Database sync complete. Saved on Kanban board.");
        } catch (err) {
          logMessage(`Database sync failed: ${err.message}`);
        }
        continue;
      }

      const easyApplyBtn = ActiveConnector.getEasyApplyButton();
      if (!easyApplyBtn) {
        logMessage("No 'Easy Apply' button available for this listing. Skipping...");
        continue;
      }

      logMessage("Easy Apply option detected! Clicking...");
      
      // Pre-set Indeed session state before clicking to avoid new-tab race conditions
      if (ActiveConnector.name === "Indeed") {
        const activeJobId = ActiveConnector.getJobId();
        if (activeJobId) {
          await new Promise(resolve => {
            chrome.storage.local.set({
              currently_applying_job_id: activeJobId,
              [`indeed_apply_status_${activeJobId}`]: "running"
            }, resolve);
          });
        }
      }

      window.clickElement(easyApplyBtn);
      await sleep(1500);

      if (!isContextValid()) break;

      // Launch modular Easy Apply form filler
      const fillSuccess = await ActiveConnector.EasyApply.automate(
        profile, 
        logMessage, 
        () => turboRunning && isContextValid()
      );

      if (!isContextValid()) break;

      if (fillSuccess) {
        appliedCount++;
        progressSpan.innerText = `${appliedCount}/${limit}`;
        logMessage("Application submitted! Syncing details to database...");
        
        try {
          await syncJobToBackend(jobData, profile.id, "Applied");
          logMessage("Database sync complete. Saved on Kanban board.");
        } catch (err) {
          logMessage(`Database sync failed: ${err.message}`);
        }
      } else {
        logMessage("Application failed, timed out, or was skipped. Saving as 'needs-knowledge-graph' for later retry...");
        try {
          await syncJobToBackend(jobData, profile.id, "needs-knowledge-graph");
          logMessage("Saved to database with status 'needs-knowledge-graph' for future retry.");
        } catch (err) {
          logMessage(`Database sync failed: ${err.message}`);
        }
      }

      logMessage("Cooling down before next application...");
      await sleep(2500);
    }

    logMessage("Turbo run finished.");
    stopTurboApply();
  };

  const stopTurboApply = () => {
    turboRunning = false;
    if (!isContextValid()) return;
    
    const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
    if (turboBtn) {
      turboBtn.classList.remove("danger");
      turboBtn.innerHTML = "<span>Launch Turbo Mode</span>";
    }
    chrome.storage.local.set({ turbo_mode_active: false });
    chrome.storage.local.remove(["greenhouse_turbo_state"]);
    updateWidgetUI();
  };

  // Sync details of a successful application to FastAPI
  const syncJobToBackend = (jobData, profileId, customStatus = "Applied") => {
    return new Promise((resolve, reject) => {
      if (!isContextValid()) return reject(new Error("Context invalidated"));

      try {
        chrome.storage.local.get(["token", "apiUrl"], (data) => {
          if (!isContextValid()) return reject(new Error("Context invalidated"));

          let api = data.apiUrl || API_DEFAULT_URL;
          if (api === "undefined" || api === "null") {
            api = API_DEFAULT_URL;
          }
          const token = data.token;

          if (!token) return reject(new Error("No credentials token"));

          const jobPayload = {
            platform_name: jobData.platform_name,
            title: jobData.title,
            company_name: jobData.company_name,
            location: jobData.location,
            job_url: jobData.job_url,
            status: customStatus,
            job_profile_id: parseInt(profileId),
            applied_date: new Date().toISOString().split("T")[0]
          };

          fetchBackend(`${api}/api/jobs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(jobPayload)
          })
          .then(savedJob => {
            if (!isContextValid()) return reject(new Error("Context invalidated"));
            return fetchBackend(`${api}/api/jobs/${savedJob.id}/tailor`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                job_profile_id: parseInt(profileId),
                job_description: jobData.job_description
              })
            });
          })
          .then(res => resolve(res))
          .catch(err => reject(err));
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  // Run the SPA change monitor
  initScraper();
}
