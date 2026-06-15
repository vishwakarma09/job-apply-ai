// connectors/indeed/index.js
// Indeed Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.Indeed = {
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

    const baseUrl = window.location.origin;
    const jobUrl = jobId ? `${baseUrl}/viewjob?jk=${jobId}` : window.location.href.split("?")[0];

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
    const filtered = containers.filter(c => c.querySelector('h2.jobTitle, .jobTitle') !== null);
    
    const uniqueCards = [];
    const seenJks = new Set();
    
    for (const card of filtered) {
      let jk = card.getAttribute('data-jk');
      if (!jk) {
        const hasJk = card.querySelector('[data-jk]');
        if (hasJk) jk = hasJk.getAttribute('data-jk');
      }
      if (!jk) {
        const link = card.querySelector('a[data-jk]');
        if (link) jk = link.getAttribute('data-jk');
      }
      
      if (jk) {
        if (!seenJks.has(jk)) {
          seenJks.add(jk);
          uniqueCards.push(card);
        }
      } else {
        uniqueCards.push(card);
      }
    }
    return uniqueCards;
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

  isAlreadyApplied() {
    const elements = Array.from(document.querySelectorAll('button, span, div, p, a'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'applied on indeed' || text === 'application submitted') {
          return true;
        }
      }
    }
    return false;
  },

  // Indeed-specific Apply automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      // CASE 1: Running in the original job search tab (monitors the new tab's progress)
      if (!window.location.hostname.includes("smartapply.indeed.com")) {
        const activeJobId = jobId || window.Connectors.Indeed.getJobId();
        console.log("[AI Job Apply Master] automate started. activeJobId:", activeJobId);
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

          // Check if Indeed Smart Apply tab is still open (after 6 seconds of grace period)
          if (i >= 6) {
            const tabsCheck = await new Promise(resolve => {
              chrome.runtime.sendMessage({ action: "checkIndeedTabs" }, resolve);
            });
            if (tabsCheck && tabsCheck.success && tabsCheck.tabCount === 0) {
              logMessage("Indeed application tab was closed or blocked. Aborting monitoring.");
              chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
              return false;
            }
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
        
        logMessage("Application monitoring timed out. Aborting and queuing for later retry.");
        chrome.storage.local.remove([`indeed_apply_status_${activeJobId}`, `indeed_outstanding_questions_${activeJobId}`]);
        return false;
      }

      // CASE 2: Running in the newly opened smartapply.indeed.com tab (performs the actual auto-fill)
      console.log("[AI Job Apply Subtab] SmartApply engine started. activeJobId:", jobId);
      logMessage(`Indeed Smart Apply auto-fill engine started... (Job ID: ${jobId})`);
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

      // Helpers for form filling and navigation
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

      const getContinueButton = () => {
        // Search the entire document because Indeed's continue/submit buttons 
        // are often in a footer outside the main <form> element.
        const searchRoot = document;

        // 1. Look for submit-application
        const submitAppBtn = searchRoot.querySelector('button[name="submit-application"], button[id*="submit-application"]');
        if (submitAppBtn) return submitAppBtn;

        // 2. Find the primary or submit button in the search root (excluding back/cancel buttons)
        const buttons = Array.from(searchRoot.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], a.ia-continue-button, .ia-continue-button'));
        const activeButtons = buttons.filter(b => {
          const text = b.innerText.toLowerCase();
          const name = (b.name || "").toLowerCase();
          const id = (b.id || "").toLowerCase();
          const cls = (b.className || "").toLowerCase();
          const style = window.getComputedStyle(b);
          
          if (style.display === 'none' || style.visibility === 'hidden' || b.disabled) {
            return false;
          }
          
          // Skip site-wide header, navigation, and menu buttons (but NOT form footers / form navigation)
          const isSiteHeaderOrNav = b.closest('header, nav, [role="navigation"], .ia-Navigation, [class*="Header"]');
          if (isSiteHeaderOrNav) {
            // Ensure we don't skip the actual form-navigation footer inside the smartapply form
            const isFormNav = b.closest('.ia-Form-navigation, .ia-Form-navigationButtons, [class*="Form-navigation"]');
            if (!isFormNav) {
              return false;
            }
          }
          
          // Skip specific known non-navigation buttons
          if (
            text.includes("back") || 
            text.includes("cancel") || 
            text.includes("close") ||
            text.includes("clear") ||
            text.includes("menu") ||
            text.includes("navigation") ||
            text.includes("account") ||
            text.includes("report") ||
            text.includes("issue") ||
            text.includes("feedback") ||
            text.includes("help") ||
            text.includes("terms") ||
            text.includes("privacy") ||
            text.includes("cookie") ||
            text.includes("options") ||
            text.includes("preferences") ||
            name.includes("menu") ||
            id.includes("menu")
          ) {
            return false;
          }
          
          return true;
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

      let blockedCount = 0;

      while (checkRunning()) {
        // Check for CAPTCHA or Cloudflare challenge
        const isCF = isCloudflareChallenge();
        const hasCaptcha = hasActiveCaptcha();
        if (isCF || hasCaptcha) {
          blockedCount++;
          if (isCF) {
            logMessage("Cloudflare verification screen detected...");
          } else {
            logMessage("CAPTCHA detected on page! Pausing automation for manual resolution...");
          }

          const storageState = await new Promise(r => {
            chrome.storage.local.get(["turbo_mode_active", `retry_apply_active_${activeJobId}`], r);
          });
          const isAutomated = storageState.turbo_mode_active || (activeJobId && storageState[`retry_apply_active_${activeJobId}`]);

          if (isAutomated && blockedCount >= 10) {
            logMessage("Automation blocked by Cloudflare/CAPTCHA for too long. Skipping job...");
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

          previousHtml = ""; // Reset to avoid unchanged HTML stall count
          unchangedCount = 0;
          await sleep(3000);
          continue;
        } else {
          blockedCount = 0;
        }

        const successHeading = Array.from(document.querySelectorAll('h1, h2, h3, .ia-PostApply-heading')).find(h => {
          const text = h.innerText.toLowerCase();
          return text.includes("submitted") || text.includes("application has been sent") || text.includes("applied");
        });

        if (successHeading) {
          logMessage("Application submission confirmed!");
          if (activeJobId) {
            console.log("[AI Job Apply Subtab] Setting status to success for:", activeJobId);
            await new Promise(resolve => {
              chrome.storage.local.set({ [`indeed_apply_status_${activeJobId}`]: "success" }, resolve);
            });
          } else {
            console.error("[AI Job Apply Subtab] activeJobId is empty! Cannot set success status in storage.");
          }
          logMessage("Closing application tab in 3 seconds...");
          await sleep(3000);
          window.close();
          return true;
        }

        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        if (inputs.length === 0) {
          const nextBtn = getContinueButton();
          if (!nextBtn) {
            await sleep(1500);
            continue;
          }
        }

        const currentHtml = document.body ? document.body.innerHTML : "";
        if (currentHtml === previousHtml) {
          unchangedCount++;
          if (unchangedCount >= 6) {
            // If the HTML has not changed for 6 iterations (~9 seconds), declare a stall.
            logMessage("Form stalled due to missing questions. Skipping job...");
            
            const storageState = await new Promise(r => {
              chrome.storage.local.get(["turbo_mode_active", `retry_apply_active_${activeJobId}`], r);
            });
            const isAutomated = storageState.turbo_mode_active || (activeJobId && storageState[`retry_apply_active_${activeJobId}`]);

            if (activeJobId) {
              chrome.storage.local.set({
                [`indeed_apply_status_${activeJobId}`]: "failed",
                [`indeed_outstanding_questions_${activeJobId}`]: true
              });
            }

            if (isAutomated) {
              await sleep(1000);
              window.close();
              return false;
            } else {
              logMessage("Manual session active. Form stalled, pausing for manual intervention.");
              return false;
            }
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
          } else if (labelText.includes("zip") || labelText.includes("postal")) {
            const loc = profile.city || profile.location || "";
            const zipMatch = loc.match(/\b\d{5}(-\d{4})?\b/);
            valueToFill = zipMatch ? zipMatch[0] : "";
          } else if (labelText.includes("state") || labelText.includes("province") || labelText.includes("region")) {
            const loc = profile.city || profile.location || "";
            const stateMatch = loc.match(/,\s*([A-Z]{2})\b/);
            valueToFill = stateMatch ? stateMatch[1] : "";
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
            const container = radios[0].closest("fieldset, [class*='question'], [class*='Container'], [class*='Module']");
            if (container) {
              const headerEl = container.querySelector("h1, h2, h3, legend, span, label, p");
              if (headerEl) labelText = headerEl.innerText.toLowerCase();
            }
            if (!labelText) {
              const legend = radios[0].closest("fieldset")?.querySelector("legend");
              if (legend) labelText = legend.innerText.toLowerCase();
            }

            let targetVal = "yes";
            if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              targetVal = (profile.visa_sponsorship === "Yes" || String(profile.visa_sponsorship).toLowerCase().includes("yes")) ? "yes" : "no";
            } else if (labelText.includes("authorized") || labelText.includes("legally") || labelText.includes("work in")) {
              targetVal = (profile.work_authorization === "Yes" || String(profile.work_authorization).toLowerCase().includes("yes")) ? "yes" : "no";
            } else if (labelText.includes("disability")) {
              targetVal = profile.disability_status || "";
            } else if (labelText.includes("veteran")) {
              targetVal = profile.veteran_status || "";
            } else if (labelText.includes("gender") || labelText.includes("sex")) {
              targetVal = profile.gender || "";
            } else if (labelText.includes("race") || labelText.includes("ethnicity")) {
              targetVal = profile.ethnicity || "";
            }

            let checkIndex = 0;
            if (name === "resume-selection") {
              let foundPreferred = false;
              radios.forEach((r, idx) => {
                const labelText = getLabelText(r).toLowerCase();
                if (!labelText.includes("without") && !labelText.includes("no-resume")) {
                  if (labelText.includes("resume") || labelText.includes(".pdf") || labelText.includes(".docx") || labelText.includes(profile.first_name?.toLowerCase())) {
                    checkIndex = idx;
                    foundPreferred = true;
                  }
                }
              });
              if (!foundPreferred && radios.length > 0) {
                // Fallback to the first option if no preferred resume option is found
                checkIndex = 0;
              }
            } else {
              let foundMatch = false;
              radios.forEach((r, idx) => {
                const labelText = getLabelText(r).toLowerCase();
                const valText = r.value.toLowerCase();
                const tVal = targetVal.toLowerCase();
                if (tVal && (labelText === tVal || labelText.includes(tVal) || valText === tVal || valText.includes(tVal))) {
                  checkIndex = idx;
                  foundMatch = true;
                }
              });

              // Fallback to "decline to answer" or similar if no match is found for sensitive topics
              if (!foundMatch && (labelText.includes("disability") || labelText.includes("veteran") || labelText.includes("gender") || labelText.includes("race") || labelText.includes("ethnicity"))) {
                radios.forEach((r, idx) => {
                  const labelText = getLabelText(r).toLowerCase();
                  if (labelText.includes("decline") || labelText.includes("prefer not") || labelText.includes("choose not")) {
                    checkIndex = idx;
                  }
                });
              }
            }

            const targetRadio = radios[checkIndex];
            if (targetRadio) {
              targetRadio.click();
              if (!targetRadio.checked) {
                targetRadio.checked = true;
                targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }
        }

        // 4. Checkboxes (Terms, Agreements)
        document.querySelectorAll("input[type='checkbox']").forEach(cb => {
          const labelText = getLabelText(cb).toLowerCase();
          if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
            cb.click();
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
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
                if (el.checked !== isTrue) {
                  el.click();
                  if (el.checked !== isTrue) {
                    el.checked = isTrue;
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }
              } else if (el.type === "radio") {
                const radios = el.name ? Array.from(document.getElementsByName(el.name)) : [el];
                const targetRadio = radios.find(r => {
                  const labelText = getLabelText(r).toLowerCase();
                  const valText = r.value.toLowerCase();
                  const fVal = String(matchedVal).toLowerCase();
                  return valText === fVal || labelText === fVal || labelText.includes(fVal);
                }) || el;
                targetRadio.click();
                if (!targetRadio.checked) {
                  targetRadio.checked = true;
                  targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                }
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
        const emptyRequiredFields = getUnfilledRequiredFields();

        if (emptyRequiredFields.length > 0 || formIteration > 5) {
          logMessage(`Required fields empty (${emptyRequiredFields.length}) or screen complex. Invoking AI Solver...`);
          try {
            const chromeData = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
            const solverApi = chromeData.apiUrl || window.API_DEFAULT_URL;
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
                        targetRadio.click();
                        if (!targetRadio.checked) {
                          targetRadio.checked = true;
                          targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                      }
                      return;
                    }
                    el = document.getElementsByName(f.name)[0];
                  }

                  if (el && f.value !== undefined && f.value !== null) {
                    if (el.type === "checkbox") {
                      const isTrue = f.value === true || String(f.value).toLowerCase() === "true" || String(f.value).toLowerCase() === "yes" || String(f.value).toLowerCase() === "1";
                      if (el.checked !== isTrue) {
                        el.click();
                        if (el.checked !== isTrue) {
                          el.checked = isTrue;
                          el.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                      }
                    } else if (el.type === "radio") {
                      const radios = el.name ? Array.from(document.getElementsByName(el.name)) : [el];
                      const targetRadio = radios.find(r => {
                        const labelText = getLabelText(r).toLowerCase();
                        const valText = r.value.toLowerCase();
                        const fVal = String(f.value).toLowerCase();
                        return valText === fVal || labelText === fVal || labelText.includes(fVal);
                      }) || el;
                      targetRadio.click();
                      if (!targetRadio.checked) {
                        targetRadio.checked = true;
                        targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
                      }
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
              const storageState = await new Promise(r => {
                chrome.storage.local.get(["turbo_mode_active", `retry_apply_active_${activeJobId}`], r);
              });
              const isAutomated = storageState.turbo_mode_active || (activeJobId && storageState[`retry_apply_active_${activeJobId}`]);

              logMessage(`Highlighting ${finalUnfilled.length} unresolved required fields...`);
              highlightUnfilledFields(finalUnfilled);

              if (activeJobId) {
                chrome.storage.local.set({
                  [`indeed_apply_status_${activeJobId}`]: "failed",
                  [`indeed_outstanding_questions_${activeJobId}`]: true
                });
              }

              if (isAutomated) {
                logMessage("Automated session active. Skipping job and closing tab...");
                await sleep(1500);
                window.close();
                return false;
              } else {
                logMessage("Manual session active. Keeping tab open. Please resolve the highlighted fields manually and proceed.");
                return false;
              }
            }
          } catch (highlightErr) {
            console.warn("[AI Job Apply] Failed to highlight unresolved fields:", highlightErr);
          }
        }

        await sleep(500);

        // 5. Navigate to Next Step (Robust Continue Button Resolution)
        const nextBtn = getContinueButton();

        if (nextBtn) {
          if (nextBtn.disabled) {
            logMessage("Continue button is disabled due to missing questions. Skipping job...");
            
            const storageState = await new Promise(r => {
              chrome.storage.local.get(["turbo_mode_active", `retry_apply_active_${activeJobId}`], r);
            });
            const isAutomated = storageState.turbo_mode_active || (activeJobId && storageState[`retry_apply_active_${activeJobId}`]);

            if (activeJobId) {
              chrome.storage.local.set({
                [`indeed_apply_status_${activeJobId}`]: "failed",
                [`indeed_outstanding_questions_${activeJobId}`]: true
              });
            }

            // Apply highlighting to unfilled required fields that might be causing the disable
            const finalUnfilled = getUnfilledRequiredFields();
            highlightUnfilledFields(finalUnfilled);

            if (isAutomated) {
              await sleep(1500);
              window.close();
              return false;
            } else {
              logMessage("Manual session active. Button is disabled, pausing for manual intervention.");
              return false;
            }
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
              const solverApi = chromeData.apiUrl || window.API_DEFAULT_URL;
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
};
