// connectors/ziprecruiter/index.js
// ZipRecruiter Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.ZipRecruiter = {
  name: "ZipRecruiter",
  
  // Selectors for DOM extraction
  selectors: {
    title: [
      "h2[class*='text-header-md']",
      "h1[class*='text-header-md']",
      "h2[class*='text-header-lg']",
      "h1[class*='text-header-lg']",
      "h3[class*='text-header-md']",
      "[data-testid='job-card-title']",
      ".job_title",
      "h1",
      "h2",
      "h3",
      "[class*='jobTitle']",
      "[class*='JobTitle']",
      "[class*='title']"
    ],
    company: [
      "a[href*='/co/']",
      "a[href*='/c/']",
      "[data-testid='job-card-company']",
      ".company_name",
      ".company",
      "[class*='companyName']",
      "[class*='CompanyName']",
      "[class*='company']",
      "h3",
      "h4"
    ],
    location: [
      "p[class*='text-body-md']",
      "[data-testid='job-card-location']",
      ".location",
      "[class*='location']",
      "[class*='Location']"
    ],
    description: [
      ".wrap-anywhere",
      "div[class*='wrap-anywhere']",
      "[data-testid='job-description']",
      ".job_description",
      ".description",
      "[class*='jobDescription']",
      "[class*='JobDescription']",
      "[class*='description']",
      "[class*='desc']",
      "[class*='Desc']"
    ]
  },

  // Helper to find the details pane container
  getDetailsContainer() {
    // 1. Try to find the sticky details pane container sibling of the job list
    const jobList = document.querySelector('.job_results_two_pane, [class*="job_results_two_pane"]');
    if (jobList && jobList.parentElement) {
      const sibling = Array.from(jobList.parentElement.children).find(el => el !== jobList && el.tagName === 'DIV');
      if (sibling) return sibling;
    }

    // 2. Try looking for the sticky column element
    const stickyEl = document.querySelector('.md\\:sticky, [class*="md:sticky"]');
    if (stickyEl) return stickyEl;

    // 3. Try finding container by selectors of description
    for (const sel of this.selectors.description) {
      const descEl = document.querySelector(sel);
      if (descEl) {
        const container = descEl.closest("article, section, [class*='details'], [class*='Details'], [id*='details'], [id*='Details']");
        if (container && container !== document.body) return container;
      }
    }
    // 4. Try common details panel selectors
    const detailsSelectors = [
      '#job_details',
      '[class*="job_details"]',
      '[class*="jobDetails"]',
      '[class*="details_container"]',
      '[class*="detailsContainer"]',
      '[data-testid="job-details"]',
    ];
    for (const sel of detailsSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return document.body;
  },

  // Extract current job ID from url or search query params
  getJobId() {
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get("job_id") || urlParams.get("jid");
    if (jobId) return jobId;

    // Pattern for /jobs/company/title-id or /c/company/job/title-id
    const matchPath = url.match(/\/jobs\/[^/]+\/[^/]+-([a-f0-9]+)\b/) || url.match(/\/job\/[^/]+-([a-f0-9]+)\b/) || url.match(/-([a-f0-9]{8,})\b/);
    if (matchPath) return matchPath[1];

    // Fallback: last segment if it looks like an ID
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      const dashParts = lastSeg.split('-');
      const possibleId = dashParts[dashParts.length - 1];
      if (possibleId && possibleId.length >= 8 && /^[a-f0-9]+$/i.test(possibleId)) {
        return possibleId;
      }
    }

    // Try finding selected job details in the details pane first to build a hash
    const container = this.getDetailsContainer();
    if (container && container !== document.body) {
      const titleEl = container.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]');
      const companyEl = container.querySelector('a[href*="/co/"], a[href*="/c/"], [class*="company"], [class*="Company"]');
      if (titleEl && companyEl) {
        const txt = (titleEl.innerText + "||" + companyEl.innerText).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (txt.length > 0) {
          // Simple hash function to generate alphanumeric ID
          let hash = 0;
          for (let i = 0; i < txt.length; i++) {
            hash = (hash << 5) - hash + txt.charCodeAt(i);
            hash |= 0;
          }
          return "zip_" + Math.abs(hash).toString(16);
        }
      }
    }

    // Fallback to active card attribute
    const activeCard = document.querySelector('[data-testid="job-card"].selected, [data-testid="job-card"].active, .job_result.selected, .job-result.active, .job_result_two_pane_v2.selected, .job_result_two_pane_v2.active');
    if (activeCard) {
      const id = activeCard.getAttribute('data-job-id') || activeCard.getAttribute('data-id') || activeCard.getAttribute('id');
      if (id) return id;
    }
    return null;
  },

  // Scrape details of currently loaded job
  scrapeDetails(jobId) {
    const container = this.getDetailsContainer() || document;
    
    let title = "Unknown Position";
    for (const sel of this.selectors.title) {
      const el = container.querySelector(sel);
      if (el && el.innerText.trim()) {
        title = el.innerText.trim();
        break;
      }
    }

    let company = "Unknown Company";
    for (const sel of this.selectors.company) {
      const el = container.querySelector(sel);
      if (el && el.innerText.trim()) {
        company = el.innerText.trim().split("\n")[0].trim();
        break;
      }
    }

    let location = "Unknown Location";
    for (const sel of this.selectors.location) {
      const el = container.querySelector(sel);
      if (el && el.innerText.trim()) {
        location = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
        break;
      }
    }

    let description = "";
    for (const sel of this.selectors.description) {
      const el = container.querySelector(sel);
      if (el && el.innerText.trim()) {
        description = el.innerText.trim();
        break;
      }
    }

    const baseUrl = window.location.origin;
    const jobUrl = jobId ? `${baseUrl}/jobs/job/${jobId}` : window.location.href.split("?")[0];

    return {
      title,
      company_name: company,
      location,
      job_url: jobUrl,
      job_description: description,
      platform_name: "ZipRecruiter"
    };
  },

  // Scrape details directly from a list card (fallback to avoid loading race conditions)
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector("button[class*='text-left'], button[class*='text-primary'], [data-testid='job-card-title'], .job_title, [class*='jobTitle'], [class*='JobTitle']");
    const companyEl = cardElement.querySelector("a[href*='/co/'], [data-testid='job-card-company'], .company_name, .company, [class*='company']");
    const locationEl = cardElement.querySelector("a[href*='location='], [data-testid='job-card-location'], .location, [class*='location']");

    const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    const company = companyEl ? companyEl.innerText.trim().split("\n")[0].trim() : "Unknown Company";
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      '.job_result_two_pane_v2',
      '[class*="job_result_two_pane"]',
      '[data-testid="job-card"]',
      '.job_result',
      '.job-result',
      '.job-list-item',
      '[class*="job-card"]',
      '[class*="jobCard"]',
      '[class*="JobCard"]'
    ];
    
    const containers = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    if (containers.length > 0) {
      return containers;
    }

    // Fallback: Resolve job link selectors
    const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/"], a[href*="/job/"]'));
    const uniqueParents = [];
    const seenCards = new Set();
    
    jobLinks.forEach(link => {
      const parentCard = link.closest("article, li, div[class*='card'], div[class*='item']");
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

    const jobLink = cardElement.querySelector("button[class*='text-left'], button[class*='text-primary']") || cardElement.querySelector('a[href*="/jobs/"]') || cardElement.querySelector('a[href*="/job/"]') || cardElement.querySelector('a') || cardElement.querySelector('button');
    if (jobLink) {
      const innerClickTarget = jobLink.querySelector("h2, h3, span, strong") || jobLink;
      window.clickElement(innerClickTarget);
      return true;
    }

    cardElement.click();
    return true;
  },

  // Find and return the ZipRecruiter "1-Click Apply" / "Quick Apply" button
  getEasyApplyButton() {
    const container = this.getDetailsContainer() || document;

    // 1. Try stable data-testid attributes inside the details container
    let btn = container.querySelector('[data-testid="quick-apply-button"], [data-testid*="quick-apply"], [data-testid*="1-click-apply"], [data-testid*="1ClickApply"]');
    if (btn) return btn;

    // 2. Scan buttons and links inside the details container
    const elements = Array.from(container.querySelectorAll('button, a, [role="button"], .quick-apply-btn, [class*="quickApply"], [class*="oneClickApply"]'));
    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (
        text.includes("1-click apply") || 
        text.includes("1 click apply") || 
        text.includes("quick apply") || 
        text === "apply now" || 
        text === "continue" || 
        text === "continuer" || 
        text === "candidature simple"
      ) {
        const href = el.getAttribute('href');
        if (href && href.startsWith('http') && !href.includes('ziprecruiter.com')) {
          continue; // Probably an external apply link
        }
        return el;
      }
    }

    // 3. Fallback: Search globally if not found in the container
    if (container !== document) {
      btn = document.querySelector('[data-testid="quick-apply-button"], [data-testid*="quick-apply"], [data-testid*="1-click-apply"], [data-testid*="1ClickApply"]');
      if (btn) return btn;
      
      const globalElements = Array.from(document.querySelectorAll('button, a, [role="button"], .quick-apply-btn, [class*="quickApply"], [class*="oneClickApply"]'));
      for (const el of globalElements) {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (
          text.includes("1-click apply") || 
          text.includes("1 click apply") || 
          text.includes("quick apply") || 
          text === "apply now" || 
          text === "continue" || 
          text === "continuer" || 
          text === "candidature simple"
        ) {
          const href = el.getAttribute('href');
          if (href && href.startsWith('http') && !href.includes('ziprecruiter.com')) {
            continue;
          }
          return el;
        }
      }
    }
    return null;
  },

  isAlreadyApplied() {
    const container = this.getDetailsContainer() || document;
    const elements = Array.from(container.querySelectorAll('button, span, div, p, a, [class*="applied"]'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'applied!' || text === 'application submitted' || text.includes('applied ') || text === 'applied on ziprecruiter') {
          return true;
        }
      }
    }
    return false;
  },

  // ZipRecruiter-specific Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Waiting for Quick Apply form/modal to load...");
      
      const getActiveFormElement = () => {
        const selector = "div[role='dialog'], [class*='modal'], [id*='modal'], form[class*='apply'], form[id*='apply'], .ziprecruiter-apply-container";
        const matches = Array.from(document.querySelectorAll(selector));
        const visibleMatches = matches.filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        const withInputs = visibleMatches.filter(el => {
          const inputs = el.querySelectorAll("input, select, textarea");
          return inputs.length > 0;
        });
        return withInputs[0] || visibleMatches[0] || matches[0] || null;
      };

      let modal = null;
      // Poll for up to 6 seconds
      for (let i = 0; i < 12; i++) {
        if (!checkRunning()) return false;
        modal = getActiveFormElement();
        if (modal) break;
        await sleep(500);
      }

      if (!modal) {
        logMessage("Quick Apply form not found! (Timeout waiting for form container)");
        return false;
      }

      // Wait for inputs to render inside modal to prevent race condition where form is filled before fields are ready
      let inputsRendered = false;
      for (let i = 0; i < 10; i++) {
        if (!checkRunning()) return false;
        const inputs = modal.querySelectorAll("input, select, textarea");
        if (inputs.length > 0) {
          inputsRendered = true;
          break;
        }
        await sleep(300);
      }
      
      // Let the form fully settle and render any async fields
      await sleep(1000);

      logMessage("ZipRecruiter Quick Apply detected. Starting auto-form filling...");
      let formIteration = 0;
      let previousSignature = "";
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

      const getContinueButton = () => {
        const form = getActiveFormElement();
        if (!form) return null;
        const selectors = ['button[type="submit"]', 'input[type="submit"]', 'button.next-btn', 'button.continue-btn', '[class*="continue"]', '[class*="submit"]', '[class*="next"]'];
        for (const sel of selectors) {
          const btns = Array.from(form.querySelectorAll(sel));
          for (const btn of btns) {
            if (btn && !btn.disabled) {
              const style = window.getComputedStyle(btn);
              if (style.display !== 'none' && style.visibility !== 'hidden') return btn;
            }
          }
        }
        const buttons = Array.from(form.querySelectorAll('button, a[role="button"]'));
        const activeButtons = buttons.filter(b => {
          const text = (b.innerText || b.textContent || '').trim().toLowerCase();
          const style = window.getComputedStyle(b);
          if (style.display === 'none' || style.visibility === 'hidden' || b.disabled) return false;
          return text.includes("continue") || text.includes("next") || text.includes("submit") || text.includes("apply") || text.includes("review");
        });
        return activeButtons[0] || null;
      };

      while (checkRunning()) {
        // Check if modal or form is still active
        const activeForm = getActiveFormElement();
        if (!activeForm) {
          logMessage("Apply form was closed.");
          return true;
        }

        const successHeading = Array.from(activeForm.querySelectorAll('h1, h2, h3, h4, p, span, div[class*="success"], div[class*="submitted"], div[id*="success"], div[id*="submitted"], .success')).find(el => {
          if (typeof window.isElementVisible === 'function' && !window.isElementVisible(el)) {
            return false;
          }
          const text = el.innerText.toLowerCase();
          return text.includes("submitted") || text.includes("application sent") || text.includes("success") || text.includes("thank you for applying");
        });

        if (successHeading) {
          logMessage("Application submission confirmed!");
          return true;
        }

        const getFormSignature = (form) => {
          const inputs = Array.from(form.querySelectorAll("input, select, textarea"));
          return inputs.map(el => {
            let val = "";
            if (el.type === "checkbox" || el.type === "radio") {
              val = el.checked ? (el.value || "on") : "off";
            } else {
              val = el.value || "";
            }
            return `${el.name || el.id || ""}:${el.type || el.tagName.toLowerCase()}:${val}`;
          }).join("|");
        };

        const currentSignature = getFormSignature(activeForm);
        if (currentSignature === previousSignature) {
          unchangedCount++;
          if (unchangedCount >= 5) {
            logMessage("Form stalled due to missing/unanswered required questions. Skipping job...");
            return false;
          }
          logMessage(`Page fields unchanged. Waiting for next step (attempt ${unchangedCount}/5)...`);
          await sleep(2500);
          continue;
        }
        unchangedCount = 0;
        previousSignature = currentSignature;
        formIteration++;

        logMessage(`Filling step ${formIteration}...`);

        // 1. Text Inputs
        const textInputs = activeForm.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea");
        textInputs.forEach(input => {
          const labelText = window.getLabelText(input).toLowerCase().trim();
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
            const labelText = window.getLabelText(select).toLowerCase().trim();
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
              const radioLabel = window.getLabelText(r).toLowerCase();
              const valText = r.value.toLowerCase();
              const tVal = targetVal.toLowerCase();
              if (tVal && (radioLabel === tVal || radioLabel.includes(tVal) || valText === tVal || valText.includes(tVal))) {
                checkIndex = idx;
                foundMatch = true;
              }
            });

            const targetRadio = radios[checkIndex];
            if (targetRadio) {
              let clickTarget = targetRadio;
              if (targetRadio.id) {
                const label = activeForm.querySelector(`label[for="${targetRadio.id}"]`);
                if (label) clickTarget = label;
              }
              if (clickTarget === targetRadio) {
                const parentLabel = targetRadio.closest("label");
                if (parentLabel) clickTarget = parentLabel;
              }
              window.clickElement(clickTarget);
              if (!targetRadio.checked) {
                targetRadio.checked = true;
                targetRadio.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }
        }

        // 4. Checkboxes (terms/agreements)
        activeForm.querySelectorAll("input[type='checkbox']").forEach(cb => {
          const labelText = window.getLabelText(cb).toLowerCase();
          if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
            let clickTarget = cb;
            if (cb.id) {
              const label = activeForm.querySelector(`label[for="${cb.id}"]`);
              if (label) clickTarget = label;
            }
            if (clickTarget === cb) {
              const parentLabel = cb.closest("label");
              if (parentLabel) clickTarget = parentLabel;
            }
            window.clickElement(clickTarget);
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });

        // 5. AI Solver fallback for remaining unfilled fields
        const getUnfilledFields = () => {
          const unfilled = [];
          // Text, textarea, select
          activeForm.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select').forEach(el => {
            if (el.type !== 'hidden' && !el.value.trim()) {
              unfilled.push(el);
            }
          });
          // Checkboxes (only if required or matching terms)
          activeForm.querySelectorAll('input[type="checkbox"]').forEach(el => {
            if ((el.required || el.getAttribute('aria-required') === 'true') && !el.checked) {
              unfilled.push(el);
            }
          });
          // Radio buttons grouped by name
          const radioGroups = {};
          activeForm.querySelectorAll("input[type='radio']").forEach(radio => {
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

        const unfilledFields = getUnfilledFields();
        if (unfilledFields.length > 0 || formIteration > 5) {
          logMessage(`Required or unfilled fields detected (${unfilledFields.length}). Invoking AI Solver...`);
          try {
            const chromeData = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
            const solverApi = chromeData.apiUrl || window.API_DEFAULT_URL;
            const solverToken = chromeData.token;

            if (solverToken) {
              const headingText = activeForm.querySelector('h1, h2, h3, h4, .title, [class*="title"]')?.innerText || "";
              const fieldsData = Array.from(activeForm.querySelectorAll('input, select, textarea')).filter(el => el.type !== 'hidden').map(el => {
                let label = "";
                if (el.type === 'radio') {
                  const legend = el.closest("fieldset")?.querySelector("legend");
                  if (legend) label = legend.innerText.trim();
                }
                if (!label) {
                  label = window.getLabelText(el);
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

              const solveResponse = await window.fetchBackend(`${solverApi}/api/jobs/solve-screen`, {
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
                logMessage("AI Solver successfully resolved ZipRecruiter fields.");
                solveResponse.fields.forEach(f => {
                  let el = null;
                  if (f.id) {
                    try {
                      el = activeForm.querySelector(`#${CSS.escape(f.id)}`) || document.getElementById(f.id);
                    } catch (e) {
                      el = document.getElementById(f.id);
                    }
                  }
                  if (!el && f.name) {
                    if (f.type === "radio") {
                      let radios = [];
                      try {
                        radios = Array.from(activeForm.querySelectorAll(`input[type="radio"][name="${f.name}"]`));
                      } catch (e) {
                        radios = Array.from(activeForm.querySelectorAll('input[type="radio"]')).filter(r => r.name === f.name);
                      }
                      const targetRadio = radios.find(r => {
                        const labelText = window.getLabelText(r).toLowerCase();
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
                    try {
                      el = activeForm.querySelector(`[name="${f.name}"]`);
                    } catch (e) {
                      const inputs = Array.from(activeForm.querySelectorAll('[name]'));
                      el = inputs.find(input => input.name === f.name);
                    }
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
                      const radios = el.name ? Array.from(activeForm.querySelectorAll(`input[type="radio"][name="${el.name}"]`)) : [el];
                      const targetRadio = radios.find(r => {
                        const labelText = window.getLabelText(r).toLowerCase();
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
              }
            }
          } catch (solverErr) {
            console.warn("[AI Job Apply] AI Solver failed for ZipRecruiter:", solverErr);
          }
        }

        // Click Next/Continue/Submit
        let continueBtn = null;
        for (let r = 0; r < 6; r++) {
          if (!checkRunning()) return false;
          continueBtn = getContinueButton();
          if (continueBtn) break;
          logMessage(`Waiting for submit/continue button to render (attempt ${r + 1}/6)...`);
          await sleep(500);
        }

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
