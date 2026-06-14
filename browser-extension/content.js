// content.js
// Chrome Extension Content Script for AI Job Apply with Modular Platform Connectors

const API_DEFAULT_URL = "http://localhost:8000";

// Helper to check if the extension context is still valid (stops orphaned script errors after extension reload)
function isContextValid() {
  try {
    return typeof chrome !== "undefined" && 
           chrome.runtime && 
           chrome.runtime.id && 
           chrome.storage && 
           chrome.storage.local;
  } catch (e) {
    return false;
  }
}

// Helper to fetch backend APIs via the background proxy to bypass CORS
function fetchBackend(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isContextValid()) {
      return reject(new Error("Extension context invalidated"));
    }

    // Safety check: Prevent fetching malformed/relative URLs which redirect to chrome-extension://invalid/
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return reject(new Error("Invalid absolute URL: " + url));
    }

    chrome.runtime.sendMessage({
      action: "fetchBackend",
      url,
      options
    }, (response) => {
      if (!isContextValid()) {
        return reject(new Error("Extension context invalidated"));
      }
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response ? response.error || `HTTP ${response.status}` : "Unknown proxy error"));
      }
    });
  });
}

const debugRemoteLog = (message) => {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: "fetchBackend",
        url: `${API_DEFAULT_URL}/api/jobs/extension-logs`,
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "DEBUG",
            message: message,
            timestamp: new Date().toISOString(),
            platform: "indeed"
          })
        }
      });
    }
  } catch (e) {
    console.warn("debugRemoteLog failed:", e);
  }
};

// Immediate evaluation log for debugging smartapply tab loading
debugRemoteLog("Script evaluated on: " + window.location.href);

// Inject script to override window.open in main world to bypass popup blocker
const injectWindowOpenInterceptor = () => {
  const code = `
    (function() {
      const originalOpen = window.open;
      window.open = function(url, name, specs) {
        console.log("[AI Job Apply Intercept] window.open intercepted:", url);
        if (url && (url.includes("smartapply.indeed.com") || url.includes("linkedin.com/checkout") || url.includes("linkedin.com/jobs") || url.includes("indeed.com/viewjob"))) {
          window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_INTERCEPTED_OPEN", { 
            detail: { url } 
          }));
          return { closed: false, close: () => {} }; // Return a mock window object to avoid page errors
        }
        return originalOpen.apply(this, arguments);
      };
    })();
  `;
  const script = document.createElement("script");
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

if (window.location.hostname.includes("indeed.com") || window.location.hostname.includes("linkedin.com")) {
  injectWindowOpenInterceptor();
  
  window.addEventListener("AI_JOB_APPLY_INTERCEPTED_OPEN", (event) => {
    const { url } = event.detail;
    console.log("[AI Job Apply Content Script] Received intercepted open request for url:", url);
    if (isContextValid()) {
      chrome.runtime.sendMessage({ action: "openTab", url }, (res) => {
        if (chrome.runtime.lastError) {
          console.error("[AI Job Apply] Failed to open intercepted tab via background:", chrome.runtime.lastError.message);
        }
      });
    }
  });

  // Also intercept programmatic click event on link tags with target="_blank"
  document.addEventListener("click", (e) => {
    let target = e.target.closest("a");
    if (target && target.target === "_blank") {
      // If clicked programmatically (untrusted click)
      if (!e.isTrusted) {
        e.preventDefault();
        const url = target.href;
        console.log("[AI Job Apply] Intercepted programmatic click on target=_blank link:", url);
        if (isContextValid()) {
          chrome.runtime.sendMessage({ action: "openTab", url });
        }
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

// ==========================================
// 2. MODULAR PLATFORM CONNECTORS FRAMEWORK
// ==========================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const Connectors = {
  LinkedIn: {
    name: "LinkedIn",
    
    // Selectors for DOM extraction
    selectors: {
      title: [
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".jobs-details__main-content h2",
        "h2.t-24",
        "h1.t-24",
        "h1.job-title",
        ".jobs-unified-top-card__content--two-pane h2"
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".jobs-details__top-card-company-archive-link",
        ".jobs-unified-top-card__primary-description a",
        "a[href*='/company/']",
        ".jobs-unified-top-card__content--two-pane a[href*='/company/']"
      ],
      location: [
        ".job-details-jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__primary-description span",
        ".jobs-unified-top-card__primary-description"
      ],
      description: [
        "#job-details",
        ".jobs-description__content",
        ".jobs-box__html-content",
        ".jobs-description"
      ]
    },

    // Extract current job ID from url or search query params
    getJobId() {
      const url = window.location.href;
      const matchView = url.match(/\/jobs\/view\/(\d+)/);
      if (matchView) return matchView[1];
      
      const urlParams = new URLSearchParams(window.location.search);
      const jobIdParam = urlParams.get("currentJobId");
      if (jobIdParam) return jobIdParam;

      return null;
    },

    // Scrape details of currently loaded job
    scrapeDetails(jobId) {
      let title = "Unknown Position";
      for (const sel of this.selectors.title) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          title = el.innerText.trim();
          break;
        }
      }

      let company = "Unknown Company";
      for (const sel of this.selectors.company) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim().split("\n")[0].trim();
          break;
        }
      }

      let location = "Unknown Location";
      for (const sel of this.selectors.location) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          let text = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
          if (text.includes("·")) {
            const parts = text.split("·");
            if (parts.length > 1) text = parts[1].trim();
          }
          location = text;
          break;
        }
      }

      let description = "";
      for (const sel of this.selectors.description) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          description = el.innerText.trim();
          break;
        }
      }

      const jobUrl = window.location.href.split("?")[0] + (jobId ? `?currentJobId=${jobId}` : "");

      return {
        title,
        company_name: company,
        location,
        job_url: jobUrl,
        job_description: description,
        platform_name: "LinkedIn"
      };
    },

    // Scrape details directly from a list card (fallback to avoid loading race conditions)
    scrapeCardDetails(cardElement) {
      if (!cardElement) return null;
      
      const titleEl = cardElement.querySelector(
        "a[href*='/jobs/view/'], a[href*='/jobs/search-results/'], .job-card-list__title, .job-card-container__link, span[class*='title']"
      );
      const companyEl = cardElement.querySelector(
        ".job-card-container__company-name, .job-card-list__company-name, [class*='company-name']"
      );
      const locationEl = cardElement.querySelector(
        ".job-card-container__metadata-item, .job-card-list__metadata-item, [class*='location'], [class*='metadata']"
      );

      const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
      const company = companyEl ? companyEl.innerText.trim().split("\n")[0].trim() : "Unknown Company";
      const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

      return { title, company, location };
    },

    // Returns array of clickable job card list elements from search results (with robust parent container resolution)
    getJobCards() {
      const containerSelectors = [
        "li.jobs-search-results__list-item",
        ".jobs-search-results-list__list-item",
        "[data-occludable-job-id]",
        "[data-job-id]",
        ".job-card-container"
      ];
      
      const containers = Array.from(document.querySelectorAll(containerSelectors.join(",")));
      if (containers.length > 0) {
        return containers;
      }

      // Fallback: Resolve job view links to their closest parent container
      const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
      const uniqueParents = new Set();
      const parentList = [];
      
      jobLinks.forEach(link => {
        const cardParent = link.closest("li, div[class*='card'], div[class*='item']");
        const target = cardParent || link.parentElement || link;
        if (target && !uniqueParents.has(target)) {
          uniqueParents.add(target);
          parentList.push(target);
        }
      });
      
      return parentList;
    },

    // Click on a specific job card without triggering a browser page refresh
    clickJobCard(cardElement) {
      if (!cardElement) return false;

      // 1. Remove target="_blank" from any anchors to prevent opening new tabs
      const anchors = cardElement.querySelectorAll("a");
      anchors.forEach(a => a.removeAttribute("target"));
      if (cardElement.tagName === "A") {
        cardElement.removeAttribute("target");
      }

      // Helper to dispatch a full sequence of click events (mousedown -> mouseup -> click)
      // This is crucial for single-page applications (like LinkedIn) that intercept mousedown/mouseup
      // to handle routing, preventing standard browser-level redirection of anchor tags.
      const dispatchClickEvents = (element) => {
        if (!element) return;
        const opts = { bubbles: true, cancelable: true, view: window };
        element.dispatchEvent(new MouseEvent("mousedown", opts));
        element.dispatchEvent(new MouseEvent("mouseup", opts));
        element.click();
      };

      // 2. Find a job view link specifically inside the card element (or if the card itself is the link)
      const jobLink = cardElement.querySelector("a[href*='/jobs/view/']") || 
                      (cardElement.tagName === "A" && cardElement.href.includes("/jobs/view/") ? cardElement : null);

      if (jobLink) {
        // Trigger LinkedIn's internal React router by clicking the inner text span/header/strong
        const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
        dispatchClickEvents(innerClickTarget);
        return true;
      }

      // 3. Fallback only if no direct job link is found (try class selectors)
      const classClickTarget = cardElement.querySelector(".job-card-list__title, .job-card-container__link");
      if (classClickTarget) {
        dispatchClickEvents(classClickTarget);
        return true;
      }

      // 4. Final safety click: do NOT click arbitrary "a" tags unless they are job view links
      dispatchClickEvents(cardElement);
      return true;
    },



    // Find and return the LinkedIn "Easy Apply" button with comprehensive selectors
    getEasyApplyButton() {
      const selectors = [
        "button.jobs-apply-button",
        ".jobs-apply-button button",
        "button[aria-label*='Easy Apply']",
        "button[aria-label^='Easy Apply']",
        "button.jobs-apply-button--top-card",
        "button[class*='apply-button']",
        ".jobs-apply-button--top-card button"
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) return btn;
      }
      return null;
    },

    // LinkedIn-specific Easy Apply workflow automation
    EasyApply: {
      async automate(profile, logMessage, checkRunning) {
        logMessage("Waiting for Easy Apply modal to load...");
        
        let modal = null;
        // Poll for up to 6 seconds (12 * 500ms)
        for (let i = 0; i < 12; i++) {
          if (!checkRunning()) return false;
          modal = document.querySelector(".jobs-easy-apply-modal, div[role='dialog'], [class*='easy-apply-modal']");
          if (modal) break;
          await sleep(500);
        }

        if (!modal) {
          logMessage("Easy Apply modal not found! (Timeout waiting for modal)");
          return false;
        }

        logMessage("Modal detected. Starting auto-form filling...");
        let loggedProfileLink = false;
        let formIteration = 0;

        let previousHtml = "";

        while (checkRunning()) {
          const currentModal = document.querySelector(".jobs-easy-apply-modal, div[role='dialog']");
          if (!currentModal) {
            logMessage("Easy Apply modal closed. Form finished.");
            return true;
          }

          // Check if we are on the same page loop to avoid getting stuck in a loop
          const currentHtml = currentModal.innerHTML;
          if (currentHtml === previousHtml) {
            logMessage("Application stalled due to unanswered questions. Skipping job...");
            const activeJobId = jobId || ActiveConnector.getJobId();
            if (activeJobId) {
              chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
            }
            // Dismiss the modal
            const dismissBtn = currentModal.querySelector("button[aria-label='Dismiss'], button[aria-label='Close'], .artdeco-modal__dismiss");
            if (dismissBtn) {
              dismissBtn.click();
            }
            return false;
          }

          previousHtml = currentHtml;
          formIteration++;
          logMessage(`Filling page ${formIteration}...`);

          // 1. Fill Text Inputs
          const inputs = currentModal.querySelectorAll("input[type='text'], input[type='tel'], input:not([type])");
          inputs.forEach(input => {
            const labelText = getLabelText(input).toLowerCase();
            let valueToFill = "";

            if (labelText.includes("phone") || labelText.includes("mobile") || labelText.includes("number")) {
              valueToFill = profile.phone || "+1 (555) 019-2834";
            } else if (labelText.includes("email")) {
              valueToFill = profile.email || "";
            } else if (labelText.includes("first name")) {
              valueToFill = profile.first_name || "";
            } else if (labelText.includes("last name")) {
              valueToFill = profile.last_name || "";
            } else if (labelText.includes("nationality") || labelText.includes("citizen")) {
              valueToFill = profile.nationality || "";
            } else if (labelText.includes("work authorization") || labelText.includes("legally authorized")) {
              valueToFill = profile.work_authorization || "";
            } else if (labelText.includes("years of experience") || labelText.includes("how many years")) {
              const skillsStr = profile.skills || "";
              const words = labelText.replace(/[^a-zA-Z0-9\s]/g, "").split(" ");
              
              for (const word of words) {
                if (word.length > 2 && skillsStr.toLowerCase().includes(word)) {
                  const match = skillsStr.match(new RegExp(`${word}:?\\s*(\\d+)`, "i"));
                  if (match) {
                    valueToFill = match[1];
                    logMessage(`Auto-filled experience query for "${word}" with value: ${valueToFill}`);
                    break;
                  }
                }
              }
              if (!valueToFill) valueToFill = "3";
            }

            if (valueToFill && !input.value) {
              input.value = valueToFill;
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 2. Select default options in dropdown selects
          const selects = currentModal.querySelectorAll("select");
          selects.forEach(select => {
            if (select.selectedIndex <= 0 && select.options.length > 1) {
              const labelText = getLabelText(select).toLowerCase();
              let targetVal = "";

              if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
                targetVal = profile.visa_sponsorship || "";
              } else if (labelText.includes("disability")) {
                targetVal = profile.disability_status || "";
              } else if (labelText.includes("veteran")) {
                targetVal = profile.veteran_status || "";
              } else if (labelText.includes("gender") || labelText.includes("sex")) {
                targetVal = profile.gender || "";
              } else if (labelText.includes("race") || labelText.includes("ethnicity")) {
                targetVal = profile.ethnicity || ""; 
              }

              let selectIndex = 1;
              if (targetVal) {
                for (let i = 0; i < select.options.length; i++) {
                  const optText = select.options[i].text.toLowerCase();
                  const valText = select.options[i].value.toLowerCase();
                  
                  if (optText.includes(targetVal.toLowerCase()) || valText.includes(targetVal.toLowerCase())) {
                    selectIndex = i;
                    logMessage(`Matching dropdown selection for "${labelText}" -> "${optText}"`);
                    break;
                  }
                }
              }
              
              select.selectedIndex = selectIndex;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 3. Select radio buttons (e.g. Yes/No work authorization questions)
          const radioGroups = {};
          currentModal.querySelectorAll("input[type='radio']").forEach(radio => {
            const name = radio.name;
            if (!radioGroups[name]) radioGroups[name] = [];
            radioGroups[name].push(radio);
          });

          for (const name in radioGroups) {
            const radios = radioGroups[name];
            const isAnyChecked = radios.some(r => r.checked);
            if (!isAnyChecked) {
              let labelText = "";
              const legend = radios[0].closest("fieldset")?.querySelector("legend");
              if (legend) labelText = legend.innerText.toLowerCase();

              let targetVal = "yes";
              if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
                targetVal = (profile.visa_sponsorship === "Yes") ? "yes" : "no";
              }

              let checkIndex = 0;
              radios.forEach((r, idx) => {
                const label = getLabelText(r).toLowerCase();
                if (label === targetVal || label.includes(targetVal)) {
                  checkIndex = idx;
                }
              });
              
              radios[checkIndex].checked = true;
              radios[checkIndex].dispatchEvent(new Event("change", { bubbles: true }));
            }
          }

          // 4. Checkboxes (auto-agree to terms if required)
          currentModal.querySelectorAll("input[type='checkbox']").forEach(cb => {
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 5. Select Resume if present in modal
          const resumeRadio = currentModal.querySelector("input[type='radio'][id*='resume']");
          if (resumeRadio && !resumeRadio.checked) {
            resumeRadio.checked = true;
            resumeRadio.dispatchEvent(new Event("change", { bubbles: true }));
          }

          await sleep(500);

          // Check for unfilled required fields in LinkedIn's modal
          try {
            const unfilled = Array.from(currentModal.querySelectorAll('input, select, textarea')).filter(el => {
              if (el.type === 'hidden') return false;
              const isReq = el.required || el.getAttribute('aria-required') === 'true';
              if (!isReq) return false;
              
              if (el.type === 'checkbox') return !el.checked;
              if (el.type === 'radio') {
                const name = el.name;
                if (name) {
                  const radios = Array.from(currentModal.querySelectorAll(`input[type="radio"][name="${name}"]`));
                  return !radios.some(r => r.checked);
                }
                return !el.checked;
              }
              return !el.value.trim();
            });
            if (unfilled.length > 0) {
              logMessage(`Detected ${unfilled.length} unfilled required fields. Skipping job...`);
              const activeJobId = jobId || ActiveConnector.getJobId();
              if (activeJobId) {
                chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
              }
              // Dismiss the modal
              const dismissBtn = currentModal.querySelector("button[aria-label='Dismiss'], button[aria-label='Close'], .artdeco-modal__dismiss");
              if (dismissBtn) {
                dismissBtn.click();
              }
              return false;
            }
          } catch (e) {
            console.warn("[AI Job Apply] Error checking unfilled fields in LinkedIn:", e);
          }

          // 6. Find and Click Next / Review / Submit Button
          const nextBtn = currentModal.querySelector("button.artdeco-button--primary, button[class*='primary'], footer button");
          if (nextBtn) {
            const btnText = nextBtn.innerText.toLowerCase();
            
            if (nextBtn.disabled) {
              logMessage("Form button is disabled due to missing questions. Skipping job...");
              const activeJobId = jobId || ActiveConnector.getJobId();
              if (activeJobId) {
                chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
              }
              // Dismiss the modal
              const dismissBtn = currentModal.querySelector("button[aria-label='Dismiss'], button[aria-label='Close'], .artdeco-modal__dismiss");
              if (dismissBtn) {
                dismissBtn.click();
              }
              return false;
            }

            if (btnText.includes("submit") || btnText.includes("send")) {
              logMessage("Clicking Submit application...");
              nextBtn.click();
              await sleep(1500);
              
              const dismissBtn = document.querySelector("button[aria-label='Dismiss'], button[aria-label='Close'], .artdeco-modal__dismiss");
              if (dismissBtn) {
                dismissBtn.click();
              }
              return true;
            } else {
              logMessage(`Clicking: "${nextBtn.innerText.trim()}"`);
              nextBtn.click();
            }
          } else {
            logMessage("Action button not found. Pausing for manual helper...");
            previousHtml = "";
            await sleep(3000);
          }

          await sleep(1500);
        }
        return false;
      }
    }
  },
  
  Indeed: {
    name: "Indeed",
    
    // Selectors for DOM extraction
    selectors: {
      title: [
        ".jobsearch-JobInfoHeader-title",
        "h1.jobsearch-JobInfoHeader-title",
        ".jobsearch-JobInfoHeader-title-container h1",
        "h2.jobTitle",
        ".jobTitle"
      ],
      company: [
        "[data-testid='inlineHeader-companyName'] a",
        "[data-testid='inlineHeader-companyName']",
        ".jobsearch-CompanyInfoContainer a",
        ".jobsearch-InlineCompanyRating div",
        ".companyName"
      ],
      location: [
        "[data-testid='inlineHeader-companyLocation'] div",
        "[data-testid='inlineHeader-companyLocation']",
        ".jobsearch-CompanyInfoContainer div:last-child",
        ".companyLocation"
      ],
      description: [
        "#jobDescriptionText",
        ".jobsearch-jobDescriptionText",
        "#jobDetailsSection"
      ]
    },

    // Extract current job ID from url or search query params
    getJobId() {
      const url = window.location.href;
      const matchView = url.match(/(?:\/viewjob|\/rc\/clk)\?.*?jk=([a-f0-9]+)/i);
      if (matchView) return matchView[1];
      
      const urlParams = new URLSearchParams(window.location.search);
      const jkParam = urlParams.get("jk") || urlParams.get("vjk");
      if (jkParam) return jkParam;

      // DOM Fallback 1: Look for active card on the left pane
      const activeCard = document.querySelector('.yosegi-InlineCard-active [data-jk], [class*="active"] [data-jk], [class*="Selected"] [data-jk], .job_seen_beacon[class*="active"]');
      if (activeCard) {
        const jk = activeCard.getAttribute('data-jk');
        if (jk) return jk;
      }
      
      // DOM Fallback 2: Look for data-jk on job title links in the active job view
      const activeJobTitleLink = document.querySelector('.jobsearch-JobInfoHeader-title-container a[data-jk], #vjs-container [data-jk], .jobsearch-ViewJobLayout-jobDisplayFeed [data-jk]');
      if (activeJobTitleLink) {
        const jk = activeJobTitleLink.getAttribute('data-jk');
        if (jk) return jk;
      }

      // DOM Fallback 3: Extract from Easy Apply button if present
      const easyApplyBtn = document.querySelector('button#indeedApplyButton, button[id*="indeedApplyButton"], button[class*="indeedApplyButton"]');
      if (easyApplyBtn) {
        const jk = easyApplyBtn.getAttribute('data-indeed-apply-jk') || easyApplyBtn.dataset.indeedApplyJk;
        if (jk) return jk;
      }

      return null;
    },

    // Scrape details of currently loaded job
    scrapeDetails(jobId) {
      let title = "Unknown Position";
      for (const sel of this.selectors.title) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          title = el.innerText.trim().replace(/\n- job post/gi, "").trim();
          break;
        }
      }

      let company = "Unknown Company";
      for (const sel of this.selectors.company) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim().split("\n")[0].trim();
          break;
        }
      }

      let location = "Unknown Location";
      for (const sel of this.selectors.location) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          let text = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
          location = text;
          break;
        }
      }

      let description = "";
      for (const sel of this.selectors.description) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          description = el.innerText.trim();
          break;
        }
      }

      const jobUrl = window.location.href.split("?")[0] + (jobId ? `?jk=${jobId}` : "");

      return {
        title,
        company_name: company,
        location,
        job_url: jobUrl,
        job_description: description,
        platform_name: "Indeed"
      };
    },

    // Scrape details directly from a list card (fallback to avoid loading race conditions)
    scrapeCardDetails(cardElement) {
      if (!cardElement) return null;
      
      const titleEl = cardElement.querySelector('h2.jobTitle, .jobTitle');
      const companyEl = cardElement.querySelector('[data-testid="company-name"], .companyName');
      const locationEl = cardElement.querySelector('[data-testid="text-location"], .companyLocation');

      const title = titleEl ? titleEl.innerText.trim().replace(/\n- job post/gi, "").trim() : "Unknown Position";
      const company = companyEl ? companyEl.innerText.trim().split("\n")[0].trim() : "Unknown Company";
      const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

      return { title, company, location };
    },

    // Returns array of clickable job card list elements from search results
    getJobCards() {
      const containerSelectors = [
        ".job_seen_beacon",
        ".result",
        "[data-jk]",
        ".slider_container"
      ];
      
      const containers = Array.from(document.querySelectorAll(containerSelectors.join(",")));
      return containers.filter(c => c.querySelector('h2.jobTitle, .jobTitle') !== null);
    },

    // Click on a specific job card without triggering a browser page refresh
    clickJobCard(cardElement) {
      if (!cardElement) return false;

      const jobLink = cardElement.querySelector('a[data-jk]') || cardElement.querySelector('a');
      if (jobLink) {
        jobLink.removeAttribute("target");
        
        // Trigger click event sequence
        const dispatchClickEvents = (element) => {
          if (!element) return;
          const opts = { bubbles: true, cancelable: true, view: window };
          element.dispatchEvent(new MouseEvent("mousedown", opts));
          element.dispatchEvent(new MouseEvent("mouseup", opts));
          element.click();
        };
        
        const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
        dispatchClickEvents(innerClickTarget);
        return true;
      }

      cardElement.click();
      return true;
    },

    // Find and return the Indeed "Apply with Indeed" / Easy Apply button
    getEasyApplyButton() {
      // 1. Try standard selectors
      let btn = document.querySelector('button#indeedApplyButton, button[id*="indeedApplyButton"], button[class*="indeedApplyButton"]');
      if (btn) return btn;

      // 2. Try finding by aria-label containing "Apply with Indeed" or "indeedapply"
      btn = document.querySelector('button[aria-label*="Apply with Indeed"], button[aria-label*="indeedapply"], a[aria-label*="Apply with Indeed"]');
      if (btn) return btn;

      // 3. Find globally by text content
      const buttons = Array.from(document.querySelectorAll('button, a, .indeedapply-button, [class*="indeedapply"]'));
      for (const el of buttons) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'apply with indeed' || text === 'easily apply' || text === 'apply now' || text.includes('apply with indeed')) {
          return el;
        }
      }

      return null;
    },

    // Indeed-specific Apply automation
    EasyApply: {
      async automate(profile, logMessage, checkRunning, jobId = null) {
        // CASE 1: Running in the original job search tab (monitors the new tab's progress)
        if (!window.location.hostname.includes("smartapply.indeed.com")) {
          const activeJobId = jobId || Connectors.Indeed.getJobId();
          if (!activeJobId) {
            logMessage("No active job ID found for Indeed automation.");
            return false;
          }

          logMessage("Indeed Easy Apply initiated. Setting up session...");
          await new Promise(resolve => {
            chrome.storage.local.set({
              currently_applying_job_id: activeJobId,
              [`indeed_apply_status_${activeJobId}`]: "running"
            }, resolve);
          });

          logMessage("Application opened in a new tab. Monitoring progress...");
          let status = "running";
          let loggedProfileLink = false;
          
          // Wait up to 75 seconds for the application to be completed in the new tab
          for (let i = 0; i < 75; i++) {
            const isRunning = checkRunning();
            logMessage(`[Debug] Monitoring loop iteration ${i}, checkRunning: ${isRunning}`);
            if (!isRunning) {
              chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
              return false;
            }
            
            const data = await new Promise(resolve => {
              chrome.storage.local.get([`indeed_apply_status_${activeJobId}`], resolve);
            });
            status = data[`indeed_apply_status_${activeJobId}`];
            logMessage(`[Debug] Status from storage for ${activeJobId}: ${status}`);
            
            if (status === "success") {
              logMessage("Indeed application submitted successfully via new tab!");
              chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
              return true;
            } else if (status === "failed") {
              logMessage("Indeed application failed or was aborted in the new tab.");
              chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
              return false;
            }

            // Check if there are outstanding questions
            const qData = await new Promise(resolve => {
              chrome.storage.local.get([`indeed_outstanding_questions_${activeJobId}`], resolve);
            });
            if (qData[`indeed_outstanding_questions_${activeJobId}`] && !loggedProfileLink) {
              logMessage("Outstanding/unresolved questions detected in Indeed application! System does not know the answer.");
              logMessage("Please update your profile knowledgebase: <a href=\"http://localhost:5173/profile\" target=\"_blank\" style=\"color: #818cf8; text-decoration: underline; font-weight: bold;\">Update Profile</a>");
              loggedProfileLink = true;
            }

            await sleep(1000);
          }
          
          logMessage("Application monitoring timed out. Completing process as fallback.");
          chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
          return true;
        }

        // CASE 2: Running in the newly opened smartapply.indeed.com tab (performs the actual auto-fill)
        logMessage("Indeed Smart Apply auto-fill engine started...");
        let previousHtml = "";
        let formIteration = 0;
        let unchangedCount = 0;
        const activeJobId = jobId;

        let learnedAnswers = {};
        if (profile && profile.answers_json) {
          try {
            learnedAnswers = typeof profile.answers_json === "string" ? JSON.parse(profile.answers_json) : profile.answers_json;
            logMessage(`Loaded ${Object.keys(learnedAnswers).length} learned answers from profile.`);
          } catch (e) {
            console.warn("[AI Job Apply] Failed to parse profile answers_json:", e);
          }
        }

        while (checkRunning()) {
          const successHeading = Array.from(document.querySelectorAll('h1, h2, h3, .ia-PostApply-heading')).find(h => {
            const text = h.innerText.toLowerCase();
            return text.includes("submitted") || text.includes("application has been sent") || text.includes("applied");
          });

          if (successHeading) {
            logMessage("Application submission confirmed!");
            if (activeJobId) {
              await new Promise(resolve => {
                chrome.storage.local.set({ [`indeed_apply_status_${activeJobId}`]: "success" }, resolve);
              });
            }
            logMessage("Closing application tab in 3 seconds...");
            await sleep(3000);
            window.close();
            return true;
          }

          const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
          if (inputs.length === 0) {
            await sleep(1500);
            continue;
          }

          const currentHtml = document.body ? document.body.innerHTML : "";
          if (currentHtml === previousHtml) {
            unchangedCount++;
            if (unchangedCount >= 6) {
              // If the HTML has not changed for 6 iterations (~9 seconds), declare a stall.
              logMessage("Form stalled due to missing questions. Skipping job...");
              if (activeJobId) {
                chrome.storage.local.set({
                  [`indeed_apply_status_${activeJobId}`]: "failed",
                  [`indeed_outstanding_questions_${activeJobId}`]: true
                });
              }
              await sleep(1000);
              window.close();
              return false;
            }
            logMessage(`Page content unchanged. Waiting for next step (attempt ${unchangedCount}/6)...`);
            await sleep(1500);
            continue;
          }
          unchangedCount = 0;

          previousHtml = currentHtml;
          formIteration++;
          logMessage(`Filling Indeed form step ${formIteration}...`);

          // 1. Fill text, email, phone, location, and custom text questions
          const textInputs = document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea");
          textInputs.forEach(input => {
            const labelText = getLabelText(input).toLowerCase();
            let valueToFill = "";

            if (labelText.includes("phone") || labelText.includes("mobile") || labelText.includes("number")) {
              valueToFill = profile.phone || "+1 (555) 019-2834";
            } else if (labelText.includes("email")) {
              valueToFill = profile.email || "";
            } else if (labelText.includes("first name") || labelText.includes("given name")) {
              valueToFill = profile.first_name || "";
            } else if (labelText.includes("last name") || labelText.includes("family name")) {
              valueToFill = profile.last_name || "";
            } else if (labelText.includes("city") || labelText.includes("location") || labelText.includes("address")) {
              valueToFill = profile.city || profile.location || "";
            } else if (labelText.includes("job title") || (input.name === "jobTitle")) {
              valueToFill = profile.title || "";
            } else if (labelText.includes("company") || (input.name === "companyName")) {
              valueToFill = profile.company || "";
            } else if (labelText.includes("experience") && (labelText.includes("years") || labelText.includes("how many"))) {
              const skillsStr = profile.skills || "";
              const words = labelText.replace(/[^a-zA-Z0-9\s]/g, "").split(" ");
              for (const word of words) {
                if (word.length > 2 && skillsStr.toLowerCase().includes(word)) {
                  const match = skillsStr.match(new RegExp(`${word}:?\\s*(\\d+)`, "i"));
                  if (match) {
                    valueToFill = match[1];
                    logMessage(`Found matching skill experience for "${word}": ${valueToFill} years`);
                    break;
                  }
                }
              }
              if (!valueToFill) valueToFill = "3"; // Default experience fallback
            }

            if (valueToFill && !input.value) {
              input.value = valueToFill;
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 2. Select Option Dropdowns
          const selects = document.querySelectorAll("select");
          selects.forEach(select => {
            if (select.selectedIndex <= 0 && select.options.length > 1) {
              const labelText = getLabelText(select).toLowerCase();
              let targetVal = "";

              if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
                targetVal = profile.visa_sponsorship || "";
              } else if (labelText.includes("disability")) {
                targetVal = profile.disability_status || "";
              } else if (labelText.includes("veteran")) {
                targetVal = profile.veteran_status || "";
              } else if (labelText.includes("gender") || labelText.includes("sex")) {
                targetVal = profile.gender || "";
              } else if (labelText.includes("race") || labelText.includes("ethnicity")) {
                targetVal = profile.ethnicity || "";
              }

              let selectIndex = 1;
              if (targetVal) {
                for (let i = 0; i < select.options.length; i++) {
                  const optText = select.options[i].text.toLowerCase();
                  const valText = select.options[i].value.toLowerCase();
                  if (optText.includes(targetVal.toLowerCase()) || valText.includes(targetVal.toLowerCase())) {
                    selectIndex = i;
                    break;
                  }
                }
              }
              select.selectedIndex = selectIndex;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 3. Radio Buttons
          const radioGroups = {};
          document.querySelectorAll("input[type='radio']").forEach(radio => {
            const name = radio.name;
            if (!radioGroups[name]) radioGroups[name] = [];
            radioGroups[name].push(radio);
          });

          for (const name in radioGroups) {
            const radios = radioGroups[name];
            const isAnyChecked = radios.some(r => r.checked);
            if (!isAnyChecked) {
              let labelText = "";
              const legend = radios[0].closest("fieldset")?.querySelector("legend");
              if (legend) labelText = legend.innerText.toLowerCase();

              let targetVal = "yes";
              if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
                targetVal = (profile.visa_sponsorship === "Yes") ? "yes" : "no";
              }

              let checkIndex = 0;
              if (name === "resume-selection") {
                radios.forEach((r, idx) => {
                  const labelText = getLabelText(r).toLowerCase();
                  if (labelText.includes("resume") || labelText.includes(".pdf") || labelText.includes(profile.first_name?.toLowerCase())) {
                    checkIndex = idx;
                  }
                });
              } else {
                radios.forEach((r, idx) => {
                  const labelText = getLabelText(r).toLowerCase();
                  if (labelText === targetVal || labelText.includes(targetVal)) {
                    checkIndex = idx;
                  }
                });
              }

              radios[checkIndex].checked = true;
              radios[checkIndex].dispatchEvent(new Event("change", { bubbles: true }));
            }
          }

          // 4. Checkboxes (Terms, Agreements)
          document.querySelectorAll("input[type='checkbox']").forEach(cb => {
            const labelText = getLabelText(cb).toLowerCase();
            if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          // 4.2. Apply Dynamic Learned Answers
          if (learnedAnswers && Object.keys(learnedAnswers).length > 0) {
            document.querySelectorAll('input, select, textarea').forEach(el => {
              if (el.type === 'hidden') return;
              
              // Skip if already filled
              if (el.type === 'checkbox' && el.checked) return;
              if (el.type === 'radio') {
                const groupRadios = el.name ? Array.from(document.getElementsByName(el.name)) : [el];
                if (groupRadios.some(r => r.checked)) return;
              }
              if ((el.tagName.toLowerCase() === 'select' && el.selectedIndex > 0) || (el.value && el.type !== 'radio' && el.type !== 'checkbox')) {
                return;
              }

              // Determine the question text
              let label = "";
              if (el.type === 'radio') {
                const legend = el.closest("fieldset")?.querySelector("legend");
                if (legend) label = legend.innerText.toLowerCase().trim();
              }
              if (!label) {
                label = getLabelText(el).toLowerCase().trim();
              }
              if (!label) return;

              // Find a key in learnedAnswers that matches
              let matchedVal = null;
              for (const [q, a] of Object.entries(learnedAnswers)) {
                const cleanQ = q.toLowerCase().trim();
                if (label === cleanQ || label.includes(cleanQ) || cleanQ.includes(label)) {
                  matchedVal = a;
                  break;
                }
              }

              if (matchedVal !== null && matchedVal !== undefined) {
                logMessage(`Auto-filling learned answer for "${label}": "${matchedVal}"`);
                if (el.type === "checkbox") {
                  const isTrue = matchedVal === "true" || matchedVal === true || String(matchedVal).toLowerCase() === "yes" || String(matchedVal).toLowerCase() === "true" || String(matchedVal).toLowerCase() === "1";
                  el.checked = isTrue;
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                } else if (el.type === "radio") {
                  const radios = el.name ? Array.from(document.getElementsByName(el.name)) : [el];
                  const targetRadio = radios.find(r => {
                    const labelText = getLabelText(r).toLowerCase();
                    const valText = r.value.toLowerCase();
                    const fVal = String(matchedVal).toLowerCase();
                    return valText === fVal || labelText === fVal || labelText.includes(fVal);
                  }) || el;
                  targetRadio.checked = true;
                  targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                } else if (el.tagName.toLowerCase() === "select") {
                  for (let i = 0; i < el.options.length; i++) {
                    const optText = el.options[i].text.toLowerCase();
                    const valText = el.options[i].value.toLowerCase();
                    const fVal = String(matchedVal).toLowerCase();
                    if (optText.includes(fVal) || valText.includes(fVal)) {
                      el.selectedIndex = i;
                      el.dispatchEvent(new Event("change", { bubbles: true }));
                      break;
                    }
                  }
                } else {
                  el.value = matchedVal;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }
            });
          }

          await sleep(500);

          // 4.5. Ask AI solver for help on unknown/unfilled required fields or complex screens
          const getUnfilledRequiredFields = () => {
            const unfilled = [];
            // Text, textarea, select
            document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select').forEach(el => {
              if (el.type !== 'hidden' && (el.required || el.getAttribute('aria-required') === 'true') && !el.value.trim()) {
                unfilled.push(el);
              }
            });
            // Checkboxes
            document.querySelectorAll('input[type="checkbox"]').forEach(el => {
              if ((el.required || el.getAttribute('aria-required') === 'true') && !el.checked) {
                unfilled.push(el);
              }
            });
            // Radio buttons grouped by name
            const radioGroups = {};
            document.querySelectorAll("input[type='radio']").forEach(radio => {
              const name = radio.name;
              if (name) {
                if (!radioGroups[name]) radioGroups[name] = [];
                radioGroups[name].push(radio);
              }
            });
            for (const name in radioGroups) {
              const group = radioGroups[name];
              const isRequired = group.some(el => el.required || el.getAttribute('aria-required') === 'true');
              const isChecked = group.some(el => el.checked);
              if (isRequired && !isChecked) {
                unfilled.push(group[0]);
              }
            }
            return unfilled;
          };

          const emptyRequiredFields = getUnfilledRequiredFields();

          if (emptyRequiredFields.length > 0 || formIteration > 5) {
            logMessage(`Required fields empty (${emptyRequiredFields.length}) or screen complex. Invoking AI Solver...`);
            try {
              const chromeData = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
              const solverApi = chromeData.apiUrl || API_DEFAULT_URL;
              const solverToken = chromeData.token;
              
              if (solverToken) {
                const headingText = document.querySelector('h1, h2, h3, .ia-JobApplicationSteps-title')?.innerText || "";
                const fieldsData = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => el.type !== 'hidden').map(el => {
                  let label = "";
                  if (el.type === 'radio') {
                    const legend = el.closest("fieldset")?.querySelector("legend");
                    if (legend) label = legend.innerText.trim();
                  }
                  if (!label) {
                    label = getLabelText(el);
                  }
                  
                  return {
                    id: el.id || '',
                    name: el.name || '',
                    type: el.type || el.tagName.toLowerCase(),
                    label: label,
                    value: el.type === 'checkbox' || el.type === 'radio' ? (el.checked ? el.value || 'on' : '') : el.value || '',
                    required: el.required || el.getAttribute('aria-required') === 'true'
                  };
                });

                const solveResponse = await fetchBackend(`${solverApi}/api/jobs/solve-screen`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${solverToken}`
                  },
                  body: JSON.stringify({
                    profile: profile,
                    url: window.location.href,
                    title: document.title,
                    heading: headingText,
                    fields: fieldsData
                  })
                });

                if (solveResponse && solveResponse.action === "fill" && solveResponse.fields) {
                  logMessage("AI Solver successfully resolved fields.");
                  solveResponse.fields.forEach(f => {
                    let el = null;
                    if (f.id) el = document.getElementById(f.id);
                    if (!el && f.name) {
                      if (f.type === "radio") {
                        const radios = Array.from(document.getElementsByName(f.name));
                        const targetRadio = radios.find(r => {
                          const labelText = getLabelText(r).toLowerCase();
                          const valText = r.value.toLowerCase();
                          const fVal = String(f.value).toLowerCase();
                          return valText === fVal || labelText === fVal || labelText.includes(fVal);
                        }) || radios[0];
                        if (targetRadio) {
                          targetRadio.checked = true;
                          targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                        return;
                      }
                      el = document.getElementsByName(f.name)[0];
                    }

                    if (el && f.value !== undefined && f.value !== null) {
                      if (el.type === "checkbox") {
                        const isTrue = f.value === true || String(f.value).toLowerCase() === "true" || String(f.value).toLowerCase() === "yes" || String(f.value).toLowerCase() === "1";
                        el.checked = isTrue;
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                      } else if (el.type === "radio") {
                        const radios = el.name ? Array.from(document.getElementsByName(el.name)) : [el];
                        const targetRadio = radios.find(r => {
                          const labelText = getLabelText(r).toLowerCase();
                          const valText = r.value.toLowerCase();
                          const fVal = String(f.value).toLowerCase();
                          return valText === fVal || labelText === fVal || labelText.includes(fVal);
                        }) || el;
                        targetRadio.checked = true;
                        targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                      } else {
                        el.value = f.value;
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                      }
                    }
                  });
                } else if (solveResponse && solveResponse.action === "redirect" && solveResponse.redirect_url) {
                  logMessage("AI Solver requested redirect: " + solveResponse.redirect_url);
                  window.location.href = solveResponse.redirect_url;
                  await sleep(2000);
                  continue;
                }
              }
            } catch (solverErr) {
              console.warn("[AI Job Apply] AI Solver failed:", solverErr);
            }

            // Highlight unfilled required fields to help the user manually resolve them
            try {
              const finalUnfilled = getUnfilledRequiredFields();
              if (finalUnfilled.length > 0) {
                logMessage(`Highlighting ${finalUnfilled.length} unresolved required fields. Skipping job...`);
                if (activeJobId) {
                  chrome.storage.local.set({
                    [`indeed_apply_status_${activeJobId}`]: "failed",
                    [`indeed_outstanding_questions_${activeJobId}`]: true
                  });
                }
                await sleep(1000);
                window.close();
                return false;
              }
            } catch (highlightErr) {
              console.warn("[AI Job Apply] Failed to highlight unresolved fields:", highlightErr);
            }
          }

          await sleep(500);

          // 5. Navigate to Next Step (Robust Continue Button Resolution)
          const getContinueButton = () => {
            const form = document.querySelector('form');
            const searchRoot = form || document;

            // 1. Look for submit-application
            const submitAppBtn = searchRoot.querySelector('button[name="submit-application"], button[id*="submit-application"]');
            if (submitAppBtn) return submitAppBtn;

            // 2. Find the primary or submit button in the search root (excluding back/cancel buttons)
            const buttons = Array.from(searchRoot.querySelectorAll('button'));
            const activeButtons = buttons.filter(b => {
              const text = b.innerText.toLowerCase();
              const style = window.getComputedStyle(b);
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     !b.disabled &&
                     !text.includes("back") && 
                     !text.includes("cancel") && 
                     !text.includes("close") &&
                     !text.includes("clear");
            });

            if (activeButtons.length > 0) {
              // Prioritize buttons containing action keywords
              const actionKeywords = ["continue", "next", "review", "submit", "apply"];
              for (const keyword of actionKeywords) {
                const matched = activeButtons.find(b => b.innerText.toLowerCase().includes(keyword));
                if (matched) return matched;
              }

              // Fallback to the last submit button inside the search root (since continue is at the bottom)
              const submitButtons = activeButtons.filter(b => b.type === 'submit');
              if (submitButtons.length > 0) {
                return submitButtons[submitButtons.length - 1];
              }

              // Ultimate fallback: the last active button
              return activeButtons[activeButtons.length - 1];
            }
            return null;
          };

          const nextBtn = getContinueButton();

          if (nextBtn) {
            if (nextBtn.disabled) {
              logMessage("Continue button is disabled due to missing questions. Skipping job...");
              if (activeJobId) {
                chrome.storage.local.set({
                  [`indeed_apply_status_${activeJobId}`]: "failed",
                  [`indeed_outstanding_questions_${activeJobId}`]: true
                });
              }
              await sleep(1000);
              window.close();
              return false;
            }

            // Auto-learn/Save current page answers before navigating
            try {
              const currentAnswers = {};
              document.querySelectorAll('input, select, textarea').forEach(el => {
                if (el.type === 'hidden') return;
                
                let label = "";
                if (el.type === 'radio') {
                  const legend = el.closest("fieldset")?.querySelector("legend");
                  if (legend) label = legend.innerText.trim();
                }
                if (!label) {
                  label = getLabelText(el).trim();
                }
                if (!label) return;
                
                let val = null;
                if (el.type === 'checkbox') {
                  val = el.checked ? 'true' : 'false';
                } else if (el.type === 'radio') {
                  if (el.checked) {
                    val = getLabelText(el).trim() || el.value;
                  }
                } else if (el.tagName.toLowerCase() === 'select') {
                  if (el.selectedIndex > 0) {
                    val = el.options[el.selectedIndex].text.trim();
                  }
                } else {
                  if (el.value) {
                    val = el.value.trim();
                  }
                }
                
                if (val !== null && val !== undefined && val !== '') {
                  currentAnswers[label] = val;
                }
              });
              
              if (Object.keys(currentAnswers).length > 0) {
                const chromeData = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
                const solverApi = chromeData.apiUrl || API_DEFAULT_URL;
                const solverToken = chromeData.token;
                if (solverToken) {
                  logMessage("Auto-learning: Saving current page answers to profile...");
                  try {
                    const res = await fetchBackend(`${solverApi}/api/profiles/active/learn`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${solverToken}`
                      },
                      body: JSON.stringify({ answers: currentAnswers })
                    });
                    if (res && res.status === "success") {
                      for (const [q, a] of Object.entries(currentAnswers)) {
                        learnedAnswers[q.toLowerCase().trim()] = String(a).trim();
                      }
                    }
                  } catch (e) {
                    console.warn("[AI Job Apply] Auto-learn fetch failed:", e);
                  }
                }
              }
            } catch (learnErr) {
              console.warn("[AI Job Apply] Error preparing auto-learn payload:", learnErr);
            }

            const btnText = nextBtn.innerText.toLowerCase();
            if (btnText.includes("submit") || btnText.includes("send") || nextBtn.name === "submit-application") {
              logMessage("Clicking submit application...");
              nextBtn.click();
              await sleep(2500);
            } else {
              logMessage(`Clicking next step: "${nextBtn.innerText.trim()}"`);
              nextBtn.click();
            }
          } else {
            logMessage("Continue button not found. Pausing...");
            previousHtml = "";
            await sleep(3000);
          }

          await sleep(1500);
        }
        return false;
      }
    }
  }
};

// Helper function to extract text label associated with an input
const getLabelText = (inputEl) => {
  if (inputEl.id) {
    const label = document.querySelector(`label[for="${inputEl.id}"]`);
    if (label) return label.innerText.trim();
  }
  const parentLabel = inputEl.closest("label");
  if (parentLabel) return parentLabel.innerText.trim();
  
  const container = inputEl.closest(".fb-form-element, .jobs-easy-apply-form-section__grouping");
  if (container) {
    const title = container.querySelector(".artdeco-text-input--label, span, legend");
    if (title) return title.innerText.trim();
  }
  return "";
};

// ==========================================
// 3. MAIN WIDGET ENGINE & AUTO-APPLY LOOP
// ==========================================
if (window.location.hostname.includes("linkedin.com") || window.location.hostname.includes("indeed.com")) {
  const ActiveConnector = window.location.hostname.includes("indeed.com") ? Connectors.Indeed : Connectors.LinkedIn;
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
    // Check if we are running in Indeed's Smart Apply flow tab or Profile Resume page
    const isSmartApply = window.location.hostname.includes("smartapply.indeed.com");
    const isProfileResume = window.location.hostname.includes("profile.indeed.com") && window.location.pathname.includes("/resume");
    
    if (isSmartApply || isProfileResume) {
      console.log("[AI Job Apply] Indeed Smart Apply or Profile page detected. URL: " + window.location.href);
      
      chrome.storage.local.get(["token", "apiUrl", "currently_applying_job_id"], (data) => {
        const api = data.apiUrl || API_DEFAULT_URL;
        const token = data.token;
        const jobId = data.currently_applying_job_id;
        
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

    const isJobDetailsPage = window.location.pathname.includes("/viewjob") || window.location.pathname.includes("/jobs/view") || window.location.pathname.includes("/rc/clk");
    if (isJobDetailsPage && !isSmartApply && !isProfileResume) {
      chrome.storage.local.get(["currently_applying_job_id"], (data) => {
        if (!isContextValid()) return;
        const activeJobId = data.currently_applying_job_id;
        if (activeJobId) {
          chrome.storage.local.get([`retry_apply_active_${activeJobId}`], (res) => {
            if (!isContextValid()) return;
            if (res[`retry_apply_active_${activeJobId}`]) {
              console.log("[AI Job Apply] Detected active retry for Job ID:", activeJobId);
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

    function startRegularScraper() {
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
        const easyApplyBtn = ActiveConnector.getEasyApplyButton();
        if (!easyApplyBtn) {
          console.log("[AI Job Apply] Easy Apply button not found on retry page.");
          chrome.storage.local.set({ [`retry_apply_status_${activeJobId}`]: "failed" });
          window.close();
          return;
        }

        console.log("[AI Job Apply] Click Easy Apply button");
        easyApplyBtn.click();
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
          turboBtn.dataset.profileId = profile.id;
          turboBtn.dataset.profileJson = JSON.stringify(profile);
        })
        .catch(err => {
          if (!isContextValid()) return;
          console.error("[AI Job Apply Extension] active profile verification failed:", err);
          statusBadge.className = "badge disconnected";
          statusBadge.innerText = "Session Expired";
          saveBtn.disabled = true;
          saveBtn.innerHTML = "<span>Log in on localhost:5173</span>";
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
    turboBtn.classList.add("danger");
    turboBtn.innerHTML = "<span>Stop Turbo Mode</span>";
    
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
      
      const retryJobs = allJobs.filter(j => j.status === 'needs-knowledge-graph');
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

      easyApplyBtn.click();
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
        const currentJobId = ActiveConnector.getJobId();
        const qData = await new Promise(r => chrome.storage.local.get([
          `indeed_outstanding_questions_${currentJobId}`,
          `retry_outstanding_questions_${currentJobId}`
        ], r));
        const isNeedsKG = qData[`indeed_outstanding_questions_${currentJobId}`] || qData[`retry_outstanding_questions_${currentJobId}`];
        
        if (isNeedsKG) {
          logMessage("Application skipped due to unanswered questions. Saving as 'needs-knowledge-graph'...");
          try {
            await syncJobToBackend(jobData, profile.id, "needs-knowledge-graph");
            logMessage("Saved to database with status 'needs-knowledge-graph'.");
          } catch (err) {
            logMessage(`Database sync failed: ${err.message}`);
          }
        } else {
          logMessage("Application skipped or canceled.");
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
