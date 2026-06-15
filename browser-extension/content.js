// content.js
// Chrome Extension Content Script for AI Job Apply with Modular Platform Connectors

let ActiveConnector = null;

// Immediate evaluation log for debugging smartapply tab loading
debugRemoteLog("Script evaluated on: " + window.location.href);

if (window.location.hostname.includes("indeed.com") || window.location.hostname.includes("linkedin.com") || window.location.hostname.includes("greenhouse.io") || window.location.hostname.includes("glassdoor.ca") || window.location.hostname.includes("glassdoor.com") || window.location.hostname.includes("ziprecruiter.com") || window.location.hostname.includes("randstad.ca") || window.location.hostname.includes("jobbank.gc.ca") || window.location.hostname.includes("careerbeacon.com") || window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1")) {
  // Clear turbo state helper
  window.addEventListener("AI_JOB_APPLY_CLEAR_TURBO", () => {
    console.log("[AI Job Apply Content Script] Received request to clear all turbo states.");
    try {
      chrome.storage.local.set({ turbo_mode_active: false });
      chrome.storage.local.remove(["greenhouse_turbo_state", "ziprecruiter_turbo_state", "randstad_turbo_state", "jobbank_turbo_state", "jobbank_search_state", "careerbeacon_turbo_state", "careerbeacon_search_state", "indeed_turbo_state"]);
    } catch (e) {
      console.error("[AI Job Apply] Failed to clear turbo states:", e);
    }
  });

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
if (window.location.hostname.includes("linkedin.com") || window.location.hostname.includes("indeed.com") || window.location.hostname.includes("greenhouse.io") || window.location.hostname.includes("glassdoor.ca") || window.location.hostname.includes("glassdoor.com") || window.location.hostname.includes("ziprecruiter.com") || window.location.hostname.includes("randstad.ca") || window.location.hostname.includes("jobbank.gc.ca") || window.location.hostname.includes("careerbeacon.com")) {
  if (window.location.hostname.includes("indeed.com")) {
    ActiveConnector = Connectors.Indeed;
  } else if (window.location.hostname.includes("linkedin.com")) {
    ActiveConnector = Connectors.LinkedIn;
  } else if (window.location.hostname.includes("greenhouse.io")) {
    ActiveConnector = Connectors.Greenhouse;
  } else if (window.location.hostname.includes("glassdoor.ca") || window.location.hostname.includes("glassdoor.com")) {
    ActiveConnector = Connectors.Glassdoor;
  } else if (window.location.hostname.includes("ziprecruiter.com")) {
    ActiveConnector = Connectors.ZipRecruiter;
  } else if (window.location.hostname.includes("randstad.ca")) {
    ActiveConnector = Connectors.Randstad;
  } else if (window.location.hostname.includes("jobbank.gc.ca")) {
    ActiveConnector = Connectors.JobBank;
  } else if (window.location.hostname.includes("careerbeacon.com")) {
    ActiveConnector = Connectors.CareerBeacon;
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
    if (window.location.hostname.includes("indeed.com") && !window.location.hostname.includes("smartapply.indeed.com") && !window.location.hostname.includes("profile.indeed.com")) {
      chrome.storage.local.get(["indeed_turbo_state"], (res) => {
        if (!isContextValid()) return;
        const state = res.indeed_turbo_state;
        if (state && state.active) {
          chrome.runtime.sendMessage({ action: "checkTabRole" }, (role) => {
            if (!isContextValid()) return;
            let isMaster = role && role.isMaster;
            
            // If the service worker restarted and masterTabId is null, 
            // the main search tab can reclaim the master role.
            if (!isMaster && (role && !role.turboModeActive) && window.location.pathname.includes("/jobs")) {
              chrome.runtime.sendMessage({ action: "setMasterTab" });
              isMaster = true;
            }
            
            if (isMaster) {
              // Detect Cloudflare challenge page
              const isCloudflare = document.title.includes("Just a moment") || 
                                   document.querySelector("#challenge-running") || 
                                   document.querySelector("#cf-challenge") ||
                                   document.querySelector("#cf-bubble");
              if (isCloudflare) {
                console.log("[AI Job Apply] Cloudflare captcha/challenge detected. Pausing Indeed Turbo Mode auto-resume. Waiting for user to solve.");
                return;
              }
              
              const is404 = document.title.includes("Page Not Found") || document.title.includes("404");
              
              if (window.location.pathname.includes("/jobs") && !is404) {
                console.log("[AI Job Apply] Resuming Indeed Turbo Mode...", state);
                resumeIndeedTurboMode(state);
              } else {
                console.log("[AI Job Apply] Indeed Turbo Mode active but not on search page. Redirecting to last search URL in 3 seconds:", state.last_search_url);
                setTimeout(() => {
                  if (state.last_search_url) {
                    window.location.href = state.last_search_url;
                  } else {
                    window.history.back();
                  }
                }, 3000);
              }
              return;
            }
            
            // If it is active but this is not the master tab (i.e. a subtab), proceed to normal subtab handling
            chrome.storage.local.get(["currently_applying_job_id"], (data) => {
              if (!isContextValid()) return;
              const activeJobId = data.currently_applying_job_id;
              if (activeJobId) {
                chrome.storage.local.get([`retry_apply_active_${activeJobId}`], (resRetry) => {
                  if (!isContextValid()) return;
                  const isRetry = resRetry[`retry_apply_active_${activeJobId}`];
                  const isAutomated = (role && role.turboModeActive) || isRetry;
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
                  continueScraperSetup(role);
                });
              } else {
                continueScraperSetup(role);
              }
            });
          });
          return;
        }
        
        // normal fallback when indeed_turbo_state is not active
        chrome.runtime.sendMessage({ action: "checkTabRole" }, (role) => {
          if (!isContextValid()) return;
          chrome.storage.local.get(["currently_applying_job_id"], (data) => {
            if (!isContextValid()) return;
            const activeJobId = data.currently_applying_job_id;
            if (activeJobId) {
              chrome.storage.local.get([`retry_apply_active_${activeJobId}`], (resRetry) => {
                if (!isContextValid()) return;
                const isRetry = resRetry[`retry_apply_active_${activeJobId}`];
                const isAutomated = (role && role.turboModeActive) || isRetry;
                const isApplyStart = window.location.href.includes("jk=") || window.location.href.includes("applystart");
                if (isAutomated && !(role && role.isMaster) && !turboRunning && !isApplyStart) {
                  console.log("[AI Job Apply] Sub-tab redirected away from apply flow. Closing tab.");
                  chrome.storage.local.set({
                    [`indeed_apply_status_${activeJobId}`]: "failed",
                    [`retry_apply_status_${activeJobId}`]: "failed"
                  }, () => {
                    window.close();
                  });
                  return;
                }
                continueScraperSetup(role);
              });
            } else {
              continueScraperSetup(role);
            }
          });
        });
      });
      return;
    }

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

    if (window.location.hostname.includes("ziprecruiter.com")) {
      chrome.storage.local.get(["ziprecruiter_turbo_state"], (res) => {
        if (!isContextValid()) return;
        const state = res.ziprecruiter_turbo_state;
        if (state && state.active) {
          console.log("[AI Job Apply] Resuming ZipRecruiter Turbo Mode...", state);
          resumeZipRecruiterTurboMode(state);
          return;
        }
        continueScraperSetup();
      });
      return;
    }
    
    if (window.location.hostname.includes("randstad.ca")) {
      chrome.storage.local.get(["randstad_turbo_state"], (res) => {
        if (!isContextValid()) return;
        const state = res.randstad_turbo_state;
        if (state && state.active) {
          console.log("[AI Job Apply] Resuming Randstad Turbo Mode...", state);
          resumeRandstadTurboMode(state);
          return;
        }
        continueScraperSetup();
      });
      return;
    }

    if (window.location.hostname.includes("jobbank.gc.ca")) {
      chrome.storage.local.get(["jobbank_turbo_state", "jobbank_search_state"], (res) => {
        if (!isContextValid()) return;
        const state = res.jobbank_turbo_state;
        if (state && state.active) {
          console.log("[AI Job Apply] Resuming JobBank Turbo Mode...", state);
          resumeJobBankTurboMode(state);
          return;
        }
        const searchState = res.jobbank_search_state;
        if (searchState && searchState.active) {
          console.log("[AI Job Apply] Resuming JobBank Search Automation...", searchState);
          handleJobBankSearchAutomation(searchState);
          return;
        }
        continueScraperSetup();
      });
      return;
    }

    if (window.location.hostname.includes("careerbeacon.com")) {
      chrome.storage.local.get(["careerbeacon_turbo_state", "careerbeacon_search_state"], (res) => {
        if (!isContextValid()) return;
        const searchState = res.careerbeacon_search_state;
        if (searchState && searchState.active) {
          console.log("[AI Job Apply] Resuming CareerBeacon Search Automation...", searchState);
          handleCareerBeaconSearchAutomation(searchState);
          return;
        }
        const state = res.careerbeacon_turbo_state;
        if (state && state.active) {
          console.log("[AI Job Apply] Resuming CareerBeacon Turbo Mode...", state);
          resumeCareerBeaconTurboMode(state);
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
                const urlParams = new URLSearchParams(window.location.search);
                const continueUrl = urlParams.get("continue");
                if (continueUrl) {
                  console.log("[AI Job Apply] Continue button not found, redirecting directly to:", continueUrl);
                  window.location.href = continueUrl;
                } else {
                  console.log("[AI Job Apply] Neither continue button nor continueUrl found on profile resume page.");
                }
              }
            }, 1500);
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
      if (window.location.hostname.includes("greenhouse.io") || window.location.hostname.includes("randstad.ca") || window.location.hostname.includes("jobbank.gc.ca") || window.location.hostname.includes("careerbeacon.com")) {
        if (!shadowRoot) {
          activeJobId = ActiveConnector.getJobId() || (window.location.hostname.includes("greenhouse.io") ? "greenhouse-dashboard" : (window.location.hostname.includes("randstad.ca") ? "randstad-dashboard" : (window.location.hostname.includes("careerbeacon.com") ? "careerbeacon-dashboard" : "jobbank-dashboard")));
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
        } else if (!jobId && (window.location.hostname.includes("greenhouse.io") || window.location.hostname.includes("randstad.ca") || window.location.hostname.includes("jobbank.gc.ca") || window.location.hostname.includes("careerbeacon.com")) && !shadowRoot) {
          activeJobId = window.location.hostname.includes("greenhouse.io") ? "greenhouse-dashboard" : (window.location.hostname.includes("randstad.ca") ? "randstad-dashboard" : (window.location.hostname.includes("careerbeacon.com") ? "careerbeacon-dashboard" : "jobbank-dashboard"));
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

  const doesJobTitleMatchProfile = (jobTitle, profileTitle) => {
    if (!profileTitle) return true;
    if (!jobTitle) return false;

    const clean = (str) => str.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s-]+/g, ' ')
      .trim();

    const cleanJob = clean(jobTitle);
    const cleanProfile = clean(profileTitle);

    if (cleanJob.includes(cleanProfile) || cleanProfile.includes(cleanJob)) {
      return true;
    }

    const stopwords = new Set([
      'and', 'or', 'in', 'of', 'the', 'a', 'for', 'with', 'to', 'at', 'on', 'by',
      'senior', 'junior', 'sr', 'jr', 'lead', 'staff', 'principal', 'entry', 'level',
      'contract', 'contractor', 'intern', 'internship', 'part', 'time', 'full', 'temporary',
      'associate', 'assistant', 'expert', 'hiring', 'urgent', 'urgently'
    ]);

    const getKeywords = (str) => str.split(' ').filter(word => word.length > 1 && !stopwords.has(word));

    const jobKeywords = getKeywords(cleanJob);
    const profileKeywords = getKeywords(cleanProfile);

    if (profileKeywords.length === 0) return true;

    let matchedCount = 0;
    for (const pKw of profileKeywords) {
      const matched = jobKeywords.some(jKw => jKw.includes(pKw) || pKw.includes(jKw));
      if (matched) {
        matchedCount++;
      }
    }

    const requiredMatches = profileKeywords.length === 1 ? 1 : Math.max(2, Math.ceil(profileKeywords.length / 2));
    if (matchedCount >= requiredMatches) {
      return true;
    }

    const synonyms = [
      ['developer', 'engineer', 'programmer', 'coder', 'dev'],
      ['representative', 'rep', 'agent', 'specialist', 'associate'],
      ['administrator', 'admin', 'coordinator'],
      ['manager', 'lead', 'director']
    ];

    let synonymMatchedCount = 0;
    for (const pKw of profileKeywords) {
      const matched = jobKeywords.some(jKw => {
        if (jKw.includes(pKw) || pKw.includes(jKw)) return true;
        return synonyms.some(group => group.includes(pKw) && group.includes(jKw));
      });
      if (matched) {
        synonymMatchedCount++;
      }
    }

    return synonymMatchedCount >= requiredMatches;
  };

  const resumeIndeedTurboMode = async (state) => {
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
    
    // Call startTurboApply with state
    startTurboApply(state);
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
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
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
    if (!turboRunning || !isContextValid()) {
      logMessage("Turbo Mode stopped by user. Aborting navigation.");
      return;
    }
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

  const resumeRandstadTurboMode = async (state) => {
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
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
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
    
    const jobId = ActiveConnector.getJobId();
    if (!jobId) {
      // Check if we are on a confirmation/success page
      const hasConfirmationText = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, div")).some(el => {
        const txt = (el.innerText || "").toLowerCase();
        return txt.includes("thank you") || txt.includes("submitted") || txt.includes("application complete") || txt.includes("success") || txt.includes("candidature envoyée");
      });
      
      if (hasConfirmationText && state.current_job_data) {
        logMessage(`Detected confirmation page! Syncing job as Applied: "${state.current_job_data.title}"...`);
        state.applied_count++;
        state.current_index++;
        
        try {
          await syncJobToBackend(state.current_job_data, state.profile_id, "Applied");
          logMessage("Synced status to Kanban board.");
        } catch (err) {
          logMessage(`Database sync failed: ${err.message}`);
        }
        
        delete state.current_job_data;
        await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
        navigateToNextRandstadJob(state, logMessage);
        return;
      }

      logMessage("Could not retrieve Job ID on current page. Skipping to next job... (not confirmation page)");
      state.current_index++;
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
      return;
    }
    
    const jobData = ActiveConnector.scrapeDetails(jobId);
    state.current_job_data = jobData;
    await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
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
      
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
      return;
    }
    
    const easyApplyBtn = ActiveConnector.getEasyApplyButton();
    if (!easyApplyBtn) {
      logMessage("No application form or Easy Apply button available. Skipping...");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
      } catch (err) {}
      
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
      return;
    }
    
    logMessage("Easy Apply option detected! Clicking apply...");
    window.clickElement(easyApplyBtn);
    
    // Wait for modal to open, retry if needed
    let modalOpened = false;
    for (let retry = 0; retry < 3; retry++) {
      await sleep(1500);
      const form = document.querySelector("#applicationForm");
      const hasVisibleFields = form && Array.from(form.querySelectorAll("input, select, textarea, button")).some(el => {
        return el.offsetWidth > 0 && el.offsetHeight > 0;
      });
      if (hasVisibleFields) {
        modalOpened = true;
        break;
      }
      if (retry < 2) {
        logMessage(`Modal didn't open. Retrying click (attempt ${retry + 2}/3)...`);
        window.clickElement(easyApplyBtn);
      }
    }

    if (!modalOpened) {
      logMessage("Failed to open application modal after retries. Skipping...");
      state.current_index++;
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
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
      
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
    } else {
      logMessage("Application submitted! Syncing details to database...");
      state.applied_count++;
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {}
      
      delete state.current_job_data;
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: state }, r));
      navigateToNextRandstadJob(state, logMessage);
    }
  };
  
  const navigateToNextRandstadJob = async (state, logMessage) => {
    if (!turboRunning || !isContextValid()) {
      logMessage("Turbo Mode stopped by user. Aborting navigation.");
      return;
    }
    if (state.applied_count >= state.limit || state.current_index >= state.job_urls.length) {
      logMessage(`Turbo run finished! Applied to ${state.applied_count}/${state.limit} jobs.`);
      
      await new Promise(r => chrome.storage.local.remove(["randstad_turbo_state"], r));
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

  const resumeJobBankTurboMode = async (state) => {
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
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
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
    
    let jobId = ActiveConnector.getJobId();
    if (!jobId) {
      // Fallback: extract from active state URL if we are on a direct apply form flow page
      const currentUrl = window.location.href;
      if (currentUrl.includes("directapply.xhtml") || currentUrl.includes("applyresumesharing")) {
        const activeUrl = state.job_urls[state.current_index];
        if (activeUrl) {
          const match = activeUrl.match(/\/(jobposting|directapply)\/(\d+)/) || activeUrl.match(/\/(jobposting|directapply)\/([a-zA-Z0-9]+)/);
          if (match) jobId = match[2];
        }
      }
    }
    
    if (!jobId) {
      logMessage("Could not retrieve Job ID on current page. Skipping to next job...");
      state.current_index++;
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: state }, r));
      navigateToNextJobBankJob(state, logMessage);
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
      
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: state }, r));
      navigateToNextJobBankJob(state, logMessage);
      return;
    }
    
    const isDirectApplyFlow = window.location.href.includes("/directapply") || window.location.href.includes("applyresumesharing") || window.location.href.includes("/apply");
    const easyApplyBtn = ActiveConnector.getEasyApplyButton();
    
    if (!easyApplyBtn && !isDirectApplyFlow) {
      logMessage("No application form or Easy Apply button available. Skipping...");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: state }, r));
      navigateToNextJobBankJob(state, logMessage);
      return;
    }
    
    if (easyApplyBtn) {
      logMessage("Easy Apply option detected! Clicking apply...");
      window.clickElement(easyApplyBtn);
      await sleep(2500);
    }

    logMessage("Automating form fill...");
    const fillSuccess = await ActiveConnector.EasyApply.automate(
      JSON.parse(state.profile_json),
      logMessage,
      () => turboRunning && isContextValid(),
      jobId
    );
    
    if (!fillSuccess) {
      logMessage("Application failed, timed out, or was skipped.");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
        logMessage("Saved to database with status 'needs-knowledge-graph'.");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: state }, r));
      navigateToNextJobBankJob(state, logMessage);
    } else {
      logMessage("Application submitted! Syncing details to database...");
      state.applied_count++;
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: state }, r));
      navigateToNextJobBankJob(state, logMessage);
    }
  };
  
  const navigateToNextJobBankJob = async (state, logMessage) => {
    if (!turboRunning || !isContextValid()) {
      logMessage("Turbo Mode stopped by user. Aborting navigation.");
      return;
    }
    if (state.applied_count >= state.limit || state.current_index >= state.job_urls.length) {
      logMessage(`Turbo run finished! Applied to ${state.applied_count}/${state.limit} jobs.`);
      
      await new Promise(r => chrome.storage.local.remove(["jobbank_turbo_state"], r));
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

    const currentUrlNoHash = window.location.href.split('#')[0];
    const nextUrlNoHash = nextUrl.split('#')[0];
    
    if (currentUrlNoHash === nextUrlNoHash) {
      console.log("[AI Job Apply] Next URL is the same page (hash change). Forcing page reload...");
      window.location.hash = new URL(nextUrl).hash;
      window.location.reload();
    } else {
      window.location.href = nextUrl;
    }
  };

  const findSearchJobsBtn = () => {
    const elements = Array.from(document.querySelectorAll('a, button, span'));
    for (const el of elements) {
      const text = (el.textContent || el.innerText || "").toLowerCase().trim();
      if (text === "search jobs" || text === "search" || text.includes("search jobs")) {
        const clickable = el.closest('a, button') || el;
        if (window.isElementVisible(clickable)) {
          return clickable;
        }
      }
    }
    const anchors = Array.from(document.querySelectorAll('a[href*="/search"], a[href*="/rechercher"]'));
    for (const a of anchors) {
      if (window.isElementVisible(a)) {
        return a;
      }
    }
    return null;
  };

  const extractLocationFromResume = (resumeText) => {
    if (!resumeText) return "";
    const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 10);
    for (const line of lines) {
      if (line.includes("Experience") || line.includes("Education") || line.includes("Skills")) continue;
      const parts = line.split(/[|•\t]|\s{2,}/);
      for (const part of parts) {
        const cleanPart = part.trim();
        const match = cleanPart.match(/^([a-zA-Z\s\.]+),\s*([a-zA-Z\s]{2,})(?:\s*,\s*([a-zA-Z\s]+))?$/);
        if (match) {
          const stateOrProv = match[2].trim();
          if (!/^\d+$/.test(stateOrProv) && !stateOrProv.includes("@")) {
            return cleanPart;
          }
        }
      }
    }
    const fallbackRegexes = [
      /([A-Z][a-zA-Z\s\.]+,\s*[A-Z][a-zA-Z\s]+,\s*Canada)/,
      /([A-Z][a-zA-Z\s\.]+,\s*[A-Z][a-zA-Z\s]+,\s*USA?)/,
      /([A-Z][a-zA-Z\s\.]+,\s*[A-Z]{2})/
    ];
    for (const regex of fallbackRegexes) {
      const match = resumeText.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    return "";
  };

  const handleCareerBeaconSearchAutomation = async (searchState) => {
    turboRunning = true;
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
    if (consoleContainer) consoleContainer.style.display = "block";
    
    const logMessage = (msg, level = "INFO") => {
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
      const timestamp = new Date().toLocaleTimeString();
      if (consoleBox) {
        consoleBox.innerHTML += `[${timestamp}] ${msg}\n`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
      }
      try {
        remoteLog(level, msg, "careerbeacon-search");
      } catch (err) {}
    };

    logMessage("CareerBeacon search automation running...");
    const isSearchPage = window.location.pathname.includes("/search") || window.location.pathname.includes("/rechercher");
    if (!isSearchPage) {
      logMessage("Not on search page. Locating 'Search Jobs' link...");
      const searchJobsBtn = findSearchJobsBtn();
      if (searchJobsBtn) {
        logMessage("Found 'Search Jobs' button. Navigating...");
        if (searchJobsBtn.tagName === "A" && searchJobsBtn.href) {
          window.location.href = searchJobsBtn.href;
        } else {
          searchJobsBtn.click();
        }
        return;
      } else {
        logMessage("Search button not found. Direct redirecting to search...");
        window.location.href = "https://www.careerbeacon.com/en/search";
        return;
      }
    }

    if (searchState.status === "navigating_to_search") {
      logMessage("Search page loaded. Extracting keywords...");
      let profileObj = null;
      try {
        profileObj = typeof searchState.profile_json === 'string' ? JSON.parse(searchState.profile_json) : searchState.profile_json;
      } catch (e) {}

      if (!profileObj) {
        logMessage("ERROR: Profile could not be parsed. Stopping search automation.");
        await new Promise(r => chrome.storage.local.remove(["careerbeacon_search_state"], r));
        return;
      }

      const jobTitle = profileObj.title;
      const location = extractLocationFromResume(profileObj.resume_text) || profileObj.city || "Toronto";
      
      logMessage(`Target job title: "${jobTitle}"`);
      logMessage(`Target location: "${location}"`);

      let keywordInput = document.querySelector("input#search_keyword, input[name='search_keyword'], input[placeholder*='Job Title'], input[placeholder*='Keywords']");
      let locationInput = document.querySelector("input#search_location, input[name='search_location'], input[placeholder*='City'], input[placeholder*='Location']");
      let searchBtn = document.querySelector("button#btn_search, button[type='submit'], input[type='submit']");

      if (!keywordInput || !locationInput || !searchBtn) {
        logMessage("Inputs not ready. Waiting 1.5 seconds...");
        await sleep(1500);
        keywordInput = document.querySelector("input#search_keyword, input[name='search_keyword'], input[placeholder*='Job Title'], input[placeholder*='Keywords']");
        locationInput = document.querySelector("input#search_location, input[name='search_location'], input[placeholder*='City'], input[placeholder*='Location']");
        searchBtn = document.querySelector("button#btn_search, button[type='submit'], input[type='submit']");
      }

      if (!keywordInput || !locationInput) {
        logMessage("ERROR: Search inputs missing. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["careerbeacon_search_state"], r));
        return;
      }

      logMessage("Populating search parameters...");
      keywordInput.value = jobTitle;
      keywordInput.dispatchEvent(new Event("input", { bubbles: true }));
      keywordInput.dispatchEvent(new Event("change", { bubbles: true }));

      locationInput.value = location;
      locationInput.dispatchEvent(new Event("input", { bubbles: true }));
      locationInput.dispatchEvent(new Event("change", { bubbles: true }));

      await sleep(1000);
      logMessage("Submitting search...");
      searchState.status = "submitted";
      await new Promise(r => chrome.storage.local.set({ careerbeacon_search_state: searchState }, r));

      if (searchBtn) {
        searchBtn.click();
      } else {
        keywordInput.closest("form")?.submit();
      }
      return;
    }

    if (searchState.status === "submitted") {
      logMessage("Search results loaded. Extracting jobs...");
      const jobCards = ActiveConnector.getJobCards();
      if (jobCards.length === 0) {
        logMessage("No jobs found for the search parameters. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["careerbeacon_search_state"], r));
        return;
      }

      const jobUrls = jobCards.map(card => {
        const link = card.querySelector("a[href*='/posting/'], a[href*='/job-'], a[href*='/job/']") || 
                     (card.tagName === "A" && (card.href.includes("/posting/") || card.href.includes("/job-") || card.href.includes("/job/")) ? card : null);
        return link ? link.href : null;
      }).filter(url => url !== null);

      if (jobUrls.length === 0) {
        logMessage("No job posting URLs found. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["careerbeacon_search_state"], r));
        return;
      }

      logMessage(`Found ${jobUrls.length} jobs. Initializing CareerBeacon Turbo state...`);
      const careerbeacon_turbo_state = {
        active: true,
        profile_id: searchState.profile_id,
        profile_json: searchState.profile_json,
        limit: searchState.limit,
        applied_count: 0,
        listing_page_url: window.location.href,
        job_urls: jobUrls,
        current_index: 0,
        status: "navigating_to_job"
      };

      await new Promise(r => {
        chrome.storage.local.remove(["careerbeacon_search_state"], () => {
          chrome.storage.local.set({ careerbeacon_turbo_state: careerbeacon_turbo_state }, r);
        });
      });

      logMessage(`Navigating to first job: ${jobUrls[0]}`);
      await sleep(1500);
      window.location.href = jobUrls[0];
    }
  };

  const handleJobBankSearchAutomation = async (searchState) => {
    turboRunning = true;
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
    if (consoleContainer) consoleContainer.style.display = "block";
    
    const logMessage = (msg, level = "INFO") => {
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
      const timestamp = new Date().toLocaleTimeString();
      if (consoleBox) {
        consoleBox.innerHTML += `[${timestamp}] ${msg}\n`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
      }
      try {
        remoteLog(level, msg, "jobbank-search");
      } catch (err) {}
    };

    logMessage("Job Bank search automation running...");
    const isSearchPage = window.location.pathname.includes("/jobsearch") && 
                         !window.location.pathname.includes("/jobposting/") && 
                         !window.location.pathname.includes("/directapply");
    if (!isSearchPage) {
      logMessage("Not on search page. Navigating to Job Bank search page...");
      searchState.status = "filling_search";
      await new Promise(r => chrome.storage.local.set({ jobbank_search_state: searchState }, r));
      window.location.href = "https://www.jobbank.gc.ca/jobsearch/";
      return;
    }

    if (searchState.status === "navigating_to_search" || searchState.status === "filling_search") {
      logMessage("Search page loaded. Extracting keywords...");
      let profileObj = null;
      try {
        profileObj = typeof searchState.profile_json === 'string' ? JSON.parse(searchState.profile_json) : searchState.profile_json;
      } catch (e) {}

      if (!profileObj) {
        logMessage("ERROR: Profile could not be parsed. Stopping search automation.");
        await new Promise(r => chrome.storage.local.remove(["jobbank_search_state"], r));
        return;
      }

      const jobTitle = profileObj.title;
      const rawLocation = extractLocationFromResume(profileObj.resume_text) || profileObj.city || "Toronto";
      // Normalize location for autocomplete (e.g. "Toronto, Ontario, Canada" -> "Toronto")
      const location = rawLocation.split(',')[0].trim();
      
      logMessage(`Target job title: "${jobTitle}"`);
      logMessage(`Target location: "${location}" (extracted from: "${rawLocation}")`);

      let keywordInput = document.getElementById('searchString') || document.querySelector('input[name="searchstring"]');
      let locationInput = document.getElementById('locationstring') || document.querySelector('input[name="locationstring"]');
      let searchBtn = document.getElementById('searchButtonDefault') || document.querySelector('button[type="submit"]');

      if (!keywordInput || !locationInput || !searchBtn) {
        logMessage("Inputs not ready. Waiting 1.5 seconds...");
        await sleep(1500);
        keywordInput = document.getElementById('searchString') || document.querySelector('input[name="searchstring"]');
        locationInput = document.getElementById('locationstring') || document.querySelector('input[name="locationstring"]');
        searchBtn = document.getElementById('searchButtonDefault') || document.querySelector('button[type="submit"]');
      }

      if (!keywordInput || !locationInput) {
        logMessage("ERROR: Search inputs missing. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["jobbank_search_state"], r));
        return;
      }

      logMessage("Populating search parameters...");
      keywordInput.value = jobTitle;
      keywordInput.dispatchEvent(new Event("input", { bubbles: true }));
      keywordInput.dispatchEvent(new Event("change", { bubbles: true }));

      locationInput.focus();
      
      logMessage("Dispatching location to typeahead in main world...");
      let successReceived = false;
      const successListener = (e) => {
        logMessage(`Autocomplete selected: "${e.detail.selectedText}"`);
        successReceived = true;
      };
      window.addEventListener("AI_JOB_APPLY_TYPEAHEAD_SUCCESS", successListener);
      
      window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_SET_TYPEAHEAD_LOCATION", {
        detail: { location: location }
      }));
      
      let waitCount = 0;
      while (waitCount < 8 && !successReceived) {
        await sleep(500);
        waitCount++;
      }
      
      window.removeEventListener("AI_JOB_APPLY_TYPEAHEAD_SUCCESS", successListener);
      
      if (!successReceived) {
        logMessage("WARNING: Autocomplete success event not received. Trying fallback input fill...");
        locationInput.value = location;
        locationInput.dispatchEvent(new Event("input", { bubbles: true }));
        locationInput.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
      }

      await sleep(1000);
      logMessage("Submitting search...");
      searchState.status = "submitted";
      await new Promise(r => chrome.storage.local.set({ jobbank_search_state: searchState }, r));

      if (searchBtn) {
        searchBtn.click();
      } else {
        keywordInput.closest("form")?.submit();
      }
      return;
    }

    if (searchState.status === "submitted") {
      logMessage("Search results loaded. Extracting jobs...");
      const jobCards = ActiveConnector.getJobCards();
      if (jobCards.length === 0) {
        logMessage("No jobs found for the search parameters. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["jobbank_search_state"], r));
        return;
      }

      // Filter cards for "direct apply" or "postuler directement"
      const jobUrls = jobCards.filter(card => {
        const text = (card.innerText || "").toLowerCase();
        return text.includes("direct apply") || text.includes("postuler directement");
      }).map(card => {
        const link = card.querySelector("a[href*='/jobposting/']") || (card.tagName === "A" && card.href.includes("/jobposting/") ? card : null);
        return link ? link.href : null;
      }).filter(url => url !== null);

      if (jobUrls.length === 0) {
        logMessage("No direct apply jobs found. Stopping.");
        await new Promise(r => chrome.storage.local.remove(["jobbank_search_state"], r));
        return;
      }

      logMessage(`Found ${jobUrls.length} direct apply jobs. Initializing Job Bank Turbo state...`);
      const jobbank_turbo_state = {
        active: true,
        profile_id: searchState.profile_id,
        profile_json: searchState.profile_json,
        limit: searchState.limit,
        applied_count: 0,
        listing_page_url: window.location.href,
        job_urls: jobUrls,
        current_index: 0,
        status: "navigating_to_job"
      };

      await new Promise(r => {
        chrome.storage.local.remove(["jobbank_search_state"], () => {
          chrome.storage.local.set({ jobbank_turbo_state: jobbank_turbo_state }, r);
        });
      });

      logMessage(`Navigating to first job: ${jobUrls[0]}`);
      await sleep(1500);
      window.location.href = jobUrls[0];
    }
  };

  const resumeCareerBeaconTurboMode = async (state) => {
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
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
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
    
    const jobId = ActiveConnector.getJobId();
    if (!jobId) {
      logMessage("Could not retrieve Job ID on current page. Skipping to next job...");
      state.current_index++;
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: state }, r));
      navigateToNextCareerBeaconJob(state, logMessage);
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
      
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: state }, r));
      navigateToNextCareerBeaconJob(state, logMessage);
      return;
    }
    
    const easyApplyBtn = ActiveConnector.getEasyApplyButton();
    if (!easyApplyBtn) {
      logMessage("No application form or Easy Apply button available. Skipping...");
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: state }, r));
      navigateToNextCareerBeaconJob(state, logMessage);
      return;
    }
    
    logMessage("Easy Apply option detected! Clicking apply...");
    window.clickElement(easyApplyBtn);
    await sleep(2500);

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
      
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: state }, r));
      navigateToNextCareerBeaconJob(state, logMessage);
    } else {
      logMessage("Application submitted! Syncing details to database...");
      state.applied_count++;
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {}
      
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: state }, r));
      navigateToNextCareerBeaconJob(state, logMessage);
    }
  };
  
  const navigateToNextCareerBeaconJob = async (state, logMessage) => {
    if (!turboRunning || !isContextValid()) {
      logMessage("Turbo Mode stopped by user. Aborting navigation.");
      return;
    }
    if (state.applied_count >= state.limit || state.current_index >= state.job_urls.length) {
      logMessage(`Turbo run finished! Applied to ${state.applied_count}/${state.limit} jobs.`);
      
      await new Promise(r => chrome.storage.local.remove(["careerbeacon_turbo_state"], r));
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

  const resumeZipRecruiterTurboMode = async (state) => {
    turboRunning = true;
    
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
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
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
    
    logMessage(`Resuming ZipRecruiter Turbo Mode progress: ${state.applied_count}/${state.limit}...`);
    
    const storage = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
    const token = storage.token;
    const api = storage.apiUrl || API_DEFAULT_URL;
    
    const jobId = ActiveConnector.getJobId();
    
    if (state.current_job_status === "filling_form" && state.current_job_id) {
      const activeForm = document.querySelector("div[role='dialog'], [class*='modal'], [id*='modal'], form[class*='apply'], form[id*='apply'], .ziprecruiter-apply-container");
      if (activeForm) {
        logMessage("Resuming application form flow...");
        const fillSuccess = await ActiveConnector.EasyApply.automate(
          JSON.parse(state.profile_json),
          logMessage,
          () => turboRunning && isContextValid()
        );
        
        await handleZipRecruiterFormOutcome(state, fillSuccess, logMessage);
      } else {
        logMessage("Form modal closed. Checking application outcome...");
        await sleep(1000);
        
        const successHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div[class*="success"], div[class*="submitted"], div[id*="success"], div[id*="submitted"], .success')).find(el => {
          if (typeof window.isElementVisible === 'function' && !window.isElementVisible(el)) return false;
          const text = el.innerText.toLowerCase();
          return text.includes("submitted") || text.includes("application sent") || text.includes("success") || text.includes("thank you for applying");
        });
        
        const isApplied = ActiveConnector.isAlreadyApplied && ActiveConnector.isAlreadyApplied();
        
        if (successHeading || isApplied) {
          await handleZipRecruiterFormOutcome(state, true, logMessage);
        } else {
          await handleZipRecruiterFormOutcome(state, false, logMessage);
        }
      }
      return;
    }
    
    if (!jobId) {
      logMessage("No active job details loaded. Advancing search list...");
      processNextZipRecruiterJob(state, logMessage);
      return;
    }
    
    const jobData = ActiveConnector.scrapeDetails(jobId);
    logMessage(`Loaded job: "${jobData.title}" at "${jobData.company_name}"`);

    let profileObj = null;
    try {
      profileObj = typeof state.profile_json === 'string' ? JSON.parse(state.profile_json) : state.profile_json;
    } catch (e) {}

    if (profileObj && profileObj.title && jobData.title) {
      if (!doesJobTitleMatchProfile(jobData.title, profileObj.title)) {
        logMessage(`Job title "${jobData.title}" does not match active profile title "${profileObj.title}". Skipping...`);
        state.processed_job_ids.push(jobId);
        state.current_index++;
        await saveZipRecruiterState(state);
        processNextZipRecruiterJob(state, logMessage);
        return;
      }
    }
    
    if (state.processed_job_ids.includes(jobId)) {
      logMessage("Job already processed in this batch. Advancing...");
      state.current_index++;
      await saveZipRecruiterState(state);
      processNextZipRecruiterJob(state, logMessage);
      return;
    }
    
    if (ActiveConnector.isAlreadyApplied && ActiveConnector.isAlreadyApplied()) {
      logMessage("Job already marked as 'Applied' on platform. Skipping...");
      state.applied_count++;
      state.processed_job_ids.push(jobId);
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {
        logMessage(`Database sync failed: ${err.message}`);
      }
      
      await saveZipRecruiterState(state);
      processNextZipRecruiterJob(state, logMessage);
      return;
    }
    
    const easyApplyBtn = ActiveConnector.getEasyApplyButton();
    if (!easyApplyBtn) {
      logMessage("No 'Easy Apply' button available for this listing. Skipping...");
      state.processed_job_ids.push(jobId);
      state.current_index++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
      } catch (err) {}
      
      await saveZipRecruiterState(state);
      processNextZipRecruiterJob(state, logMessage);
      return;
    }
    
    logMessage("Easy Apply option detected! Launching form automation...");
    state.current_job_id = jobId;
    state.current_job_title = jobData.title;
    state.current_job_company = jobData.company_name;
    state.current_job_status = "filling_form";
    await saveZipRecruiterState(state);
    
    window.clickElement(easyApplyBtn);
    await sleep(1500);
    
    const fillSuccess = await ActiveConnector.EasyApply.automate(
      JSON.parse(state.profile_json),
      logMessage,
      () => turboRunning && isContextValid()
    );
    
    await handleZipRecruiterFormOutcome(state, fillSuccess, logMessage);
  };
  
  const handleZipRecruiterFormOutcome = async (state, fillSuccess, logMessage) => {
    state.processed_job_ids.push(state.current_job_id);
    
    const jobData = ActiveConnector.scrapeDetails(state.current_job_id);
    if (jobData.title === "Unknown Position" && state.current_job_title) {
      jobData.title = state.current_job_title;
    }
    if (jobData.company_name === "Unknown Company" && state.current_job_company) {
      jobData.company_name = state.current_job_company;
    }
    
    if (fillSuccess) {
      logMessage("Application submitted successfully! Syncing details to database...");
      state.applied_count++;
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "Applied");
        logMessage("Synced status to Kanban board.");
      } catch (err) {
        logMessage(`Database sync failed: ${err.message}`);
      }
    } else {
      logMessage("Application failed, timed out, or was skipped.");
      
      try {
        await syncJobToBackend(jobData, state.profile_id, "needs-knowledge-graph");
        logMessage("Saved to database with status 'needs-knowledge-graph' for future retry.");
      } catch (err) {}
    }
    
    state.current_index++;
    state.current_job_id = null;
    state.current_job_title = "";
    state.current_job_company = "";
    state.current_job_status = "idle";
    await saveZipRecruiterState(state);
    
    logMessage("Cooling down before next application...");
    await sleep(2500);
    processNextZipRecruiterJob(state, logMessage);
  };
  
  const processNextZipRecruiterJob = async (state, logMessage) => {
    const jobCards = ActiveConnector.getJobCards();
    const progressSpan = shadowRoot.querySelector("#turbo-progress");
    if (progressSpan) progressSpan.innerText = `${state.applied_count}/${state.limit}`;
    
    if (state.applied_count >= state.limit || state.current_index >= jobCards.length) {
      logMessage(`Turbo run finished! Applied to ${state.applied_count}/${state.limit} jobs.`);
      await new Promise(r => chrome.storage.local.remove(["ziprecruiter_turbo_state"], r));
      turboRunning = false;
      
      const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
      if (turboBtn) {
        turboBtn.classList.remove("danger");
        turboBtn.innerHTML = "<span>Turbo Run Complete!</span>";
        setTimeout(() => {
          turboBtn.innerHTML = "<span>Launch Turbo Mode</span>";
        }, 3000);
      }
      return;
    }
    
    const card = jobCards[state.current_index];
    logMessage(`--- Job Item ${state.current_index + 1}/${jobCards.length} ---`);
    
    const cardDetails = ActiveConnector.scrapeCardDetails(card);
    if (cardDetails) {
      logMessage(`Selecting: "${cardDetails.title}" at "${cardDetails.company}"...`);
      
      let profileObj = null;
      try {
        profileObj = typeof state.profile_json === 'string' ? JSON.parse(state.profile_json) : state.profile_json;
      } catch (e) {}

      if (profileObj && profileObj.title && cardDetails.title) {
        if (!doesJobTitleMatchProfile(cardDetails.title, profileObj.title)) {
          logMessage(`Job title "${cardDetails.title}" does not match active profile title "${profileObj.title}". Skipping card...`);
          const cardJobId = card.getAttribute('data-job-id') || card.getAttribute('data-id') || card.getAttribute('id') || `card_${state.current_index}`;
          state.processed_job_ids.push(cardJobId);
          state.current_index++;
          await saveZipRecruiterState(state);
          processNextZipRecruiterJob(state, logMessage);
          return;
        }
      }
    }
    
    try {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      console.warn("[AI Job Apply] scrollIntoView failed:", e);
    }
    await sleep(800);
    
    state.current_job_status = "loading_details";
    await saveZipRecruiterState(state);
    
    ActiveConnector.clickJobCard(card);
    logMessage("Clicked job card. Waiting for details to load/reload...");
    await sleep(5000);

    // If the page did not reload, resume execution manually
    if (turboRunning && isContextValid()) {
      chrome.storage.local.get(["ziprecruiter_turbo_state"], async (res) => {
        if (!isContextValid()) return;
        const freshState = res.ziprecruiter_turbo_state;
        if (freshState && freshState.active && freshState.current_job_status === "loading_details") {
          logMessage("No page reload detected. Analyzing job details...");
          freshState.current_job_status = "analyzing_details";
          await saveZipRecruiterState(freshState);
          resumeZipRecruiterTurboMode(freshState);
        }
      });
    }
  };
  
  const saveZipRecruiterState = (state) => {
    return new Promise(r => chrome.storage.local.set({ ziprecruiter_turbo_state: state }, r));
  };

  // ==========================================
  // 4. TURBO MODE AUTOMATION ENGINE
  // ==========================================
  const startTurboApply = async (resumedState = null) => {
    if (!isContextValid()) return;
    
    let profile, limit, appliedCount, processedJks;
    
    if (resumedState) {
      profile = JSON.parse(resumedState.profile_json);
      limit = resumedState.limit;
      appliedCount = resumedState.applied_count;
      processedJks = resumedState.processed_jks || [];
    } else {
      const turboBtn = shadowRoot.querySelector("#btn-start-turbo");
      const profileJsonStr = turboBtn ? turboBtn.dataset.profileJson : null;
      if (!profileJsonStr) return;
      profile = JSON.parse(profileJsonStr);
      const limitSelect = shadowRoot.querySelector("#turbo-limit");
      limit = parseInt(limitSelect ? limitSelect.value : "10");
      appliedCount = 0;
      processedJks = [];
    }

    const turboBtn = shadowRoot.querySelector("#btn-start-turbo");

    turboRunning = true;
    chrome.runtime.sendMessage({ action: "setMasterTab" });
    if (turboBtn) {
      turboBtn.classList.add("danger");
      turboBtn.innerHTML = "<span>Stop Turbo Mode</span>";
    }
    chrome.storage.local.set({ turbo_mode_active: true });
    
    // Clear and show console
    const consoleContainer = shadowRoot.querySelector("#turbo-console-container");
    const consoleBox = shadowRoot.querySelector("#turbo-console");
    const progressSpan = shadowRoot.querySelector("#turbo-progress");
    
    if (consoleContainer) consoleContainer.style.display = "block";
    if (resumedState) {
      if (consoleBox) consoleBox.innerHTML = `[${new Date().toLocaleTimeString()}] Resuming Indeed Turbo Mode...\n`;
      if (progressSpan) progressSpan.innerText = `${appliedCount}/${limit}`;
    } else {
      if (consoleBox) consoleBox.innerHTML = "";
      if (progressSpan) progressSpan.innerText = `0/${limit}`;
    }

    const logMessage = (msg, level = "INFO") => {
      console.log(`[AI Job Apply Turbo] [${level}] ${msg}`);
      const timestamp = new Date().toLocaleTimeString();
      if (consoleBox) consoleBox.innerHTML += `[${timestamp}] ${msg}\n`;
      if (consoleBox) consoleBox.scrollTop = consoleBox.scrollHeight;
      
      try {
        const currentJobId = ActiveConnector.getJobId();
        remoteLog(level, msg, currentJobId);
      } catch (err) {
        console.warn("[AI Job Apply] Error sending remote log:", err);
      }
    };

    const saveIndeedTurboState = async () => {
      if (window.location.hostname.includes("indeed.com")) {
        const stateToSave = {
          active: true,
          profile_id: profile.id,
          profile_json: JSON.stringify(profile),
          limit: limit,
          applied_count: appliedCount,
          last_search_url: window.location.href,
          processed_jks: processedJks
        };
        await new Promise(r => chrome.storage.local.set({ indeed_turbo_state: stateToSave }, r));
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

    if (window.location.hostname.includes("ziprecruiter.com")) {
      const jobCards = ActiveConnector.getJobCards();
      if (jobCards.length === 0) {
        logMessage("No job listings detected in the search list!");
        stopTurboApply();
        return;
      }
      
      logMessage(`Found ${jobCards.length} job cards. Initializing ZipRecruiter Turbo Mode...`);
      
      const ziprecruiter_turbo_state = {
        active: true,
        platform: "ZipRecruiter",
        profile_id: profile.id,
        profile_json: profileJsonStr,
        limit: limit,
        applied_count: 0,
        current_index: 0,
        processed_job_ids: [],
        current_job_id: null,
        current_job_status: "idle",
        current_job_title: "",
        current_job_company: ""
      };
      
      await new Promise(r => chrome.storage.local.set({ ziprecruiter_turbo_state: ziprecruiter_turbo_state }, r));
      processNextZipRecruiterJob(ziprecruiter_turbo_state, logMessage);
      return;
    }

    if (window.location.hostname.includes("randstad.ca")) {
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
      
      logMessage(`Found ${jobUrls.length} job URLs. Initializing Randstad Multi-Job Turbo Mode...`);
      
      const randstad_turbo_state = {
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
      
      await new Promise(r => chrome.storage.local.set({ randstad_turbo_state: randstad_turbo_state }, r));
      logMessage(`Navigating to first job URL in 1.5 seconds: ${jobUrls[0]}`);
      await sleep(1500);
      window.location.href = jobUrls[0];
      return;
    }

    if (window.location.hostname.includes("jobbank.gc.ca")) {
      const jobCards = ActiveConnector.getJobCards();
      const isSearchPage = window.location.pathname.includes("/jobsearch") && 
                           !window.location.pathname.includes("/jobposting/") && 
                           !window.location.pathname.includes("/directapply");
      
      if (jobCards.length === 0 || !isSearchPage) {
        logMessage("No job listings detected or not on search page. Starting Job Bank search automation...");
        
        const jobbank_search_state = {
          active: true,
          profile_id: profile.id,
          profile_json: profileJsonStr,
          limit: limit,
          status: "navigating_to_search"
        };
        
        await new Promise(r => chrome.storage.local.set({ jobbank_search_state: jobbank_search_state }, r));
        logMessage("Navigating to Job Bank search page...");
        await sleep(1500);
        window.location.href = "https://www.jobbank.gc.ca/jobsearch/";
        return;
      }
      
      const jobUrls = jobCards.filter(card => {
        const text = (card.innerText || "").toLowerCase();
        return text.includes("direct apply") || text.includes("postuler directement");
      }).map(card => {
        const link = card.querySelector("a[href*='/jobposting/']") || (card.tagName === "A" && card.href.includes("/jobposting/") ? card : null);
        return link ? link.href : null;
      }).filter(url => url !== null);
      
      if (jobUrls.length === 0) {
        logMessage("No job application URLs found in listing cards!");
        stopTurboApply();
        return;
      }
      
      logMessage(`Found ${jobUrls.length} job URLs. Initializing Job Bank Multi-Job Turbo Mode...`);
      
      const jobbank_turbo_state = {
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
      
      await new Promise(r => chrome.storage.local.set({ jobbank_turbo_state: jobbank_turbo_state }, r));
      logMessage(`Navigating to first job URL in 1.5 seconds: ${jobUrls[0]}`);
      await sleep(1500);
      
      const currentUrlNoHash = window.location.href.split('#')[0];
      const nextUrlNoHash = jobUrls[0].split('#')[0];
      if (currentUrlNoHash === nextUrlNoHash) {
        console.log("[AI Job Apply] First URL is the same page (hash change). Forcing page reload...");
        window.location.hash = new URL(jobUrls[0]).hash;
        window.location.reload();
      } else {
        window.location.href = jobUrls[0];
      }
      return;
    }

    if (window.location.hostname.includes("careerbeacon.com")) {
      const jobCards = ActiveConnector.getJobCards();
      const isSearchPage = window.location.pathname.includes("/search") || window.location.pathname.includes("/rechercher");
      
      if (jobCards.length === 0 || !isSearchPage) {
        logMessage("No job listings detected or not on search page. Starting CareerBeacon search automation...");
        
        const careerbeacon_search_state = {
          active: true,
          profile_id: profile.id,
          profile_json: profileJsonStr,
          limit: limit,
          status: "navigating_to_search"
        };
        
        await new Promise(r => chrome.storage.local.set({ careerbeacon_search_state: careerbeacon_search_state }, r));
        
        const searchJobsBtn = findSearchJobsBtn();
        if (searchJobsBtn) {
          logMessage("Found 'Search Jobs' link. Clicking...");
          if (searchJobsBtn.tagName === "A" && searchJobsBtn.href) {
            window.location.href = searchJobsBtn.href;
          } else {
            searchJobsBtn.click();
          }
        } else {
          logMessage("Search Jobs link not found. Navigating directly to CareerBeacon search...");
          window.location.href = "https://www.careerbeacon.com/en/search";
        }
        return;
      }
      
      const jobUrls = jobCards.map(card => {
        const link = card.querySelector("a[href*='/posting/'], a[href*='/job-'], a[href*='/job/']") || 
                     (card.tagName === "A" && (card.href.includes("/posting/") || card.href.includes("/job-") || card.href.includes("/job/")) ? card : null);
        return link ? link.href : null;
      }).filter(url => url !== null);
      
      if (jobUrls.length === 0) {
        logMessage("No job application URLs found in listing cards!");
        stopTurboApply();
        return;
      }
      
      logMessage(`Found ${jobUrls.length} job URLs. Initializing CareerBeacon Multi-Job Turbo Mode...`);
      
      const careerbeacon_turbo_state = {
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
      
      await new Promise(r => chrome.storage.local.set({ careerbeacon_turbo_state: careerbeacon_turbo_state }, r));
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

      // Get unique job identifier if indeed
      let indeedJk = null;
      if (window.location.hostname.includes("indeed.com")) {
        indeedJk = card.getAttribute('data-jk');
        if (!indeedJk) {
          const hasJk = card.querySelector('[data-jk]');
          if (hasJk) indeedJk = hasJk.getAttribute('data-jk');
        }
        if (!indeedJk) {
          const link = card.querySelector('a[data-jk]');
          if (link) indeedJk = link.getAttribute('data-jk');
        }
        
        if (indeedJk && processedJks.includes(indeedJk)) {
          logMessage(`Job key ${indeedJk} already processed in this batch. Skipping...`);
          continue;
        }
      }

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
        if (indeedJk) {
          processedJks.push(indeedJk);
          await saveIndeedTurboState();
        }
        continue;
      }

      if (jobId && processedJks.includes(jobId)) {
        logMessage(`Job ID ${jobId} already processed. Skipping...`);
        if (indeedJk && !processedJks.includes(indeedJk)) {
          processedJks.push(indeedJk);
          await saveIndeedTurboState();
        }
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
        if (indeedJk) processedJks.push(indeedJk);
        if (jobId && !processedJks.includes(jobId)) processedJks.push(jobId);
        await saveIndeedTurboState();
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
        if (indeedJk) processedJks.push(indeedJk);
        if (jobId && !processedJks.includes(jobId)) processedJks.push(jobId);
        await saveIndeedTurboState();
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
        if (indeedJk) processedJks.push(indeedJk);
        if (jobId && !processedJks.includes(jobId)) processedJks.push(jobId);
        await saveIndeedTurboState();
        
        try {
          await syncJobToBackend(jobData, profile.id, "Applied");
          logMessage("Database sync complete. Saved on Kanban board.");
        } catch (err) {
          logMessage(`Database sync failed: ${err.message}`);
        }
      } else {
        logMessage("Application failed, timed out, or was skipped. Saving as 'needs-knowledge-graph' for later retry...");
        if (indeedJk) processedJks.push(indeedJk);
        if (jobId && !processedJks.includes(jobId)) processedJks.push(jobId);
        await saveIndeedTurboState();
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
    chrome.storage.local.remove(["greenhouse_turbo_state", "ziprecruiter_turbo_state", "randstad_turbo_state", "jobbank_turbo_state", "jobbank_search_state", "careerbeacon_turbo_state", "careerbeacon_search_state", "indeed_turbo_state"]);
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
