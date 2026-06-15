// connectors/glassdoor/index.js
// Glassdoor Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.Glassdoor = {
  name: "Glassdoor",
  
  // Selectors for DOM extraction
  selectors: {
    title: [
      "[data-test='job-title']",
      "h1[data-test='job-title']",
      ".job-title",
      "h1.job-title",
      ".JobDetails_jobTitle__Rw5af",
      "[class*='jobTitle']",
      "[class*='JobTitle']",
      "h1",
      "h2"
    ],
    company: [
      "[data-test='employer-name']",
      ".employer-name",
      "[class*='employerName']",
      "[class*='EmployerName']",
      "[class*='companyName']",
      "[class*='CompanyName']",
      ".company-name",
      "h4"
    ],
    location: [
      "[data-test='emp-location']",
      "[data-test='employer-location']",
      ".location",
      "[class*='location']",
      "[class*='Location']"
    ],
    description: [
      "[data-test='job-description']",
      "#JobDescriptionContainer",
      ".job-description",
      "[class*='jobDescription']",
      "[class*='JobDescription']",
      "[class*='desc']"
    ]
  },

  // Extract current job ID from url or search query params
  getJobId() {
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const jl = urlParams.get("jl") || urlParams.get("jobListingId");
    if (jl) return jl;

    // Fallback: match jl in the url path or anywhere in search string
    const match = url.match(/[?&]jl=(\d+)/) || url.match(/-JV_\d+_KO\d+,\d+_KE\d+,\d+\.htm\?jl=(\d+)/) || url.match(/jl=(\d+)/);
    if (match) return match[1];

    // Fallback to DOM elements
    const activeCard = document.querySelector('[class*="selected"] [data-id], .selected [data-id], [class*="active"] [data-id], [data-test="jobListing"][class*="selected"]');
    if (activeCard) {
      const id = activeCard.getAttribute('data-jobid') || activeCard.getAttribute('data-id') || activeCard.getAttribute('data-job-id') || activeCard.querySelector('[data-jobid]')?.getAttribute('data-jobid');
      if (id) return id;
    }
    
    // Check if there's any element with data-test="job-link"
    const jobLink = document.querySelector('[data-test="job-link"]');
    if (jobLink) {
      const href = jobLink.getAttribute('href');
      if (href) {
        const jlMatch = href.match(/[?&]jl=(\d+)/) || href.match(/jl=(\d+)/);
        if (jlMatch) return jlMatch[1];
      }
    }
    return null;
  },

  // Scrape details of currently loaded job
  scrapeDetails(jobId) {
    let title = "Unknown Position";
    for (const sel of this.selectors.title) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        title = el.innerText.trim().replace(/\n.*$/g, "").trim(); // Strip rating if any
        break;
      }
    }

    let company = "Unknown Company";
    for (const sel of this.selectors.company) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        company = el.innerText.trim().split("\n")[0].trim();
        // Strip company rating suffix (e.g. "Google\n4.5 ★")
        company = company.replace(/\s+\d+\.\d+\s*★?$/g, "").replace(/\s+★$/g, "").trim();
        break;
      }
    }

    let location = "Unknown Location";
    for (const sel of this.selectors.location) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        location = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
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
    const jobUrl = jobId ? `${baseUrl}/Job/jobs.htm?jl=${jobId}` : window.location.href.split("?")[0];

    return {
      title,
      company_name: company,
      location,
      job_url: jobUrl,
      job_description: description,
      platform_name: "Glassdoor"
    };
  },

  // Scrape details directly from a list card (fallback to avoid loading race conditions)
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector('[data-test="job-title"], .job-title, [class*="jobTitle"], [class*="JobTitle"]');
    const companyEl = cardElement.querySelector('[data-test="employer-name"], .employer-name, [class*="employerName"], [class*="EmployerName"]');
    const locationEl = cardElement.querySelector('[data-test="emp-location"], .location, [class*="location"]');

    let title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    let company = companyEl ? companyEl.innerText.trim().split("\n")[0].trim() : "Unknown Company";
    // Strip company rating suffix (e.g. "Google\n4.5 ★")
    company = company.replace(/\s+\d+\.\d+\s*★?$/g, "").replace(/\s+★$/g, "").trim();
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      '[data-test="jobListing"]',
      '.react-job-listing',
      '[class*="JobCard"]',
      '[class*="jobCard"]',
      '[class*="job-card"]'
    ];
    
    const containers = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    if (containers.length > 0) {
      return containers;
    }

    // Fallback: Resolve job link selectors
    const jobLinks = Array.from(document.querySelectorAll('a[href*="jl="], a[data-test="job-link"]'));
    const uniqueParents = [];
    const seenCards = new Set();
    
    jobLinks.forEach(link => {
      const parentCard = link.closest("li, div[class*='card'], div[class*='item']");
      const target = parentCard || link.parentElement || link;
      if (target && !seenCards.has(target)) {
        seenCards.add(target);
        uniqueParents.push(target);
      }
    });

    return uniqueParents;
  },

  // Click on a specific job card without triggering a browser page refresh
  clickJobCard(cardElement) {
    if (!cardElement) return false;

    // Remove target="_blank" from any anchors to prevent opening new tabs
    const anchors = cardElement.querySelectorAll("a");
    anchors.forEach(a => a.removeAttribute("target"));
    if (cardElement.tagName === "A") {
      cardElement.removeAttribute("target");
    }

    const jobLink = cardElement.querySelector('a[data-test="job-link"]') || cardElement.querySelector('a[href*="jl="]') || cardElement.querySelector('a');
    if (jobLink) {
      const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
      window.clickElement(innerClickTarget);
      return true;
    }

    cardElement.click();
    return true;
  },

  // Find and return the Glassdoor "Easy Apply" / "Apply Now" button
  getEasyApplyButton() {
    // 1. Try stable data-test attributes
    let btn = document.querySelector('[data-test="easy-apply-button"], [data-test*="easy-apply"], [data-test*="EasyApply"]');
    if (btn) return btn;

    // 2. Scan buttons and links for text content matching "easy apply"
    const elements = Array.from(document.querySelectorAll('button, a, [role="button"], .easy-apply-btn, [class*="easyApply"]'));
    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (text.includes("easy apply") || text === "easy apply" || text.includes("easily apply") || text.includes("apply now") || text.includes("apply on glassdoor")) {
        // Avoid external site apply links if possible (they have href going to external sites)
        const href = el.getAttribute('href');
        if (href && href.startsWith('http') && !href.includes('glassdoor.ca') && !href.includes('glassdoor.com')) {
          continue; // Probably an external apply link
        }
        return el;
      }
    }
    return null;
  },

  isAlreadyApplied() {
    const elements = Array.from(document.querySelectorAll('button, span, div, p, a, [class*="applied"]'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'application submitted' || text.includes('applied ') || text === 'applied on glassdoor') {
          return true;
        }
      }
    }
    return false;
  },

  // Glassdoor-specific Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Waiting for Easy Apply form/modal to load...");
      
      let modal = null;
      // Poll for up to 6 seconds
      for (let i = 0; i < 12; i++) {
        if (!checkRunning()) return false;
        modal = document.querySelector("div[role='dialog'], [class*='modal'], [id*='modal'], form[class*='apply'], form[id*='apply'], .glassdoor-apply-container");
        if (modal) break;
        await sleep(500);
      }

      if (!modal) {
        logMessage("Easy Apply form not found! (Timeout waiting for form container)");
        return false;
      }

      logMessage("Glassdoor Easy Apply detected. Starting auto-form filling...");
      let formIteration = 0;
      let previousHtml = "";
      let unchangedCount = 0;

      let learnedAnswers = {};
      if (profile && profile.answers_json) {
        try {
          learnedAnswers = typeof profile.answers_json === "string" ? JSON.parse(profile.answers_json) : profile.answers_json;
          logMessage(`Loaded ${Object.keys(learnedAnswers).length} learned answers from profile.`);
        } catch (e) {
          console.warn("[AI Job Apply] Failed to parse profile answers_json:", e);
        }
      }

      // Helper to identify labels
      const getLabelText = (inputEl) => {
        if (inputEl.id) {
          const label = document.querySelector(`label[for="${inputEl.id}"]`);
          if (label) return label.innerText.trim();
        }
        const parentLabel = inputEl.closest("label");
        if (parentLabel) return parentLabel.innerText.trim();
        
        const container = inputEl.closest(".form-group, [class*='group'], [class*='row'], [class*='field']");
        if (container) {
          const title = container.querySelector("span, legend, label, p");
          if (title) return title.innerText.trim();
        }
        
        const placeholder = inputEl.getAttribute("placeholder");
        if (placeholder) return placeholder;

        return "";
      };

      const getContinueButton = () => {
        const selectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button.next-btn',
          'button.continue-btn',
          '[class*="continue"]',
          '[class*="submit"]',
          '[class*="next"]'
        ];
        
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn && !btn.disabled) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return btn;
            }
          }
        }

        const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
        const activeButtons = buttons.filter(b => {
          const text = b.innerText.toLowerCase();
          const style = window.getComputedStyle(b);
          if (style.display === 'none' || style.visibility === 'hidden' || b.disabled) {
            return false;
          }
          return text.includes("continue") || text.includes("next") || text.includes("submit") || text.includes("apply") || text.includes("review");
        });

        return activeButtons[0] || null;
      };

      while (checkRunning()) {
        const successHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span')).find(el => {
          const text = el.innerText.toLowerCase();
          return text.includes("submitted") || text.includes("application sent") || text.includes("success") || text.includes("thank you for applying");
        });

        if (successHeading) {
          logMessage("Application submission confirmed!");
          return true;
        }

        // Check if modal or form is still active
        const activeForm = document.querySelector("div[role='dialog'], [class*='modal'], [id*='modal'], form[class*='apply'], form[id*='apply'], .glassdoor-apply-container");
        if (!activeForm) {
          logMessage("Apply form was closed.");
          return true;
        }

        const currentHtml = activeForm.innerHTML;
        if (currentHtml === previousHtml) {
          unchangedCount++;
          if (unchangedCount >= 6) {
            logMessage("Form stalled due to missing/unanswered required questions. Skipping job...");
            return false;
          }
          logMessage(`Page content unchanged. Waiting for next step (attempt ${unchangedCount}/6)...`);
          await sleep(1500);
          continue;
        }
        unchangedCount = 0;
        previousHtml = currentHtml;
        formIteration++;

        logMessage(`Filling step ${formIteration}...`);

        // 1. Text Inputs
        const textInputs = activeForm.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea");
        textInputs.forEach(input => {
          const labelText = getLabelText(input).toLowerCase().trim();
          let valueToFill = "";

          // Check learned answers first
          let matchedVal = null;
          for (const [q, a] of Object.entries(learnedAnswers)) {
            const cleanQ = q.toLowerCase().trim();
            if (labelText === cleanQ || labelText.includes(cleanQ) || cleanQ.includes(labelText)) {
              matchedVal = a;
              break;
            }
          }

          if (matchedVal !== null && matchedVal !== undefined && String(matchedVal).trim() !== "") {
            valueToFill = String(matchedVal).trim();
          } else if (labelText.includes("phone") || labelText.includes("mobile") || labelText.includes("number")) {
            valueToFill = profile.phone || "+1 (555) 019-2834";
          } else if (labelText.includes("email")) {
            valueToFill = profile.email || "";
          } else if (labelText.includes("first name") || labelText.includes("given name")) {
            valueToFill = profile.first_name || "";
          } else if (labelText.includes("last name") || labelText.includes("family name")) {
            valueToFill = profile.last_name || "";
          } else if (labelText.includes("city") || labelText.includes("location") || labelText.includes("address")) {
            valueToFill = profile.city || profile.location || "";
          } else if (labelText.includes("zip") || labelText.includes("postal")) {
            const loc = profile.city || profile.location || "";
            const zipMatch = loc.match(/\b\d{5}(-\d{4})?\b/);
            valueToFill = zipMatch ? zipMatch[0] : "";
          }

          if (valueToFill && !input.value) {
            input.value = valueToFill;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        // 2. Selects
        const selects = activeForm.querySelectorAll("select");
        selects.forEach(select => {
          if (select.selectedIndex <= 0 && select.options.length > 1) {
            const labelText = getLabelText(select).toLowerCase().trim();
            let targetVal = "";

            let matchedVal = null;
            for (const [q, a] of Object.entries(learnedAnswers)) {
              const cleanQ = q.toLowerCase().trim();
              if (labelText === cleanQ || labelText.includes(cleanQ) || cleanQ.includes(labelText)) {
                matchedVal = a;
                break;
              }
            }

            if (matchedVal !== null && matchedVal !== undefined && String(matchedVal).trim() !== "") {
              targetVal = String(matchedVal).trim();
            } else if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              targetVal = profile.visa_sponsorship || "";
            } else if (labelText.includes("disability")) {
              targetVal = profile.disability_status || "";
            } else if (labelText.includes("veteran")) {
              targetVal = profile.veteran_status || "";
            } else if (labelText.includes("gender") || labelText.includes("sex")) {
              targetVal = profile.gender || "";
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
        activeForm.querySelectorAll("input[type='radio']").forEach(radio => {
          const name = radio.name;
          if (name) {
            if (!radioGroups[name]) radioGroups[name] = [];
            radioGroups[name].push(radio);
          }
        });

        for (const name in radioGroups) {
          const radios = radioGroups[name];
          const isAnyChecked = radios.some(r => r.checked);
          if (!isAnyChecked) {
            let labelText = "";
            const container = radios[0].closest("fieldset, [class*='question'], [class*='group']");
            if (container) {
              const headerEl = container.querySelector("legend, span, label, p");
              if (headerEl) labelText = headerEl.innerText.toLowerCase();
            }

            let targetVal = "yes";
            if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              targetVal = (profile.visa_sponsorship === "Yes" || String(profile.visa_sponsorship).toLowerCase().includes("yes")) ? "yes" : "no";
            } else if (labelText.includes("authorized") || labelText.includes("legally") || labelText.includes("work in")) {
              targetVal = (profile.work_authorization === "Yes" || String(profile.work_authorization).toLowerCase().includes("yes")) ? "yes" : "no";
            }

            let checkIndex = 0;
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

        // 4. Checkboxes (terms/agreements)
        activeForm.querySelectorAll("input[type='checkbox']").forEach(cb => {
          const labelText = getLabelText(cb).toLowerCase();
          if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
            cb.click();
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });

        // Click Next/Continue/Submit
        const continueBtn = getContinueButton();
        if (continueBtn) {
          logMessage("Advancing form...");
          continueBtn.click();
        } else {
          logMessage("Stuck: No next or submit button found!");
          return false;
        }

        await sleep(1500);
      }

      return false;
    }
  }
};
