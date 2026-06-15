// connectors/greenhouse/index.js
// Greenhouse Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.Greenhouse = {
  name: "Greenhouse",
  
  // Selectors for DOM extraction
  selectors: {
    title: [
      ".app-title",
      "h1.app-title",
      ".job-name",
      "h1",
      "h2",
      "[class*='title']"
    ],
    company: [
      ".company-name",
      "span.company",
      "span.company-name",
      ".company-header",
      "h3.company",
      "[class*='company']"
    ],
    location: [
      ".location",
      ".job-location",
      ".job-metadata .location",
      "[class*='location']"
    ],
    description: [
      "#content",
      ".job-description",
      "#job-description",
      "#description",
      "[class*='description']"
    ]
  },

  // Extract current job ID from url or search query params
  getJobId() {
    const url = window.location.href;
    
    // Pattern 1: boards.greenhouse.io/company/jobs/123456
    const matchView = url.match(/\/jobs\/(\d+)/);
    if (matchView) return matchView[1];
    
    // Pattern 2: my.greenhouse.io dashboard details/application URLs
    const matchApp = url.match(/\/applications\/(\d+)/);
    if (matchApp) return matchApp[1];

    const urlParams = new URLSearchParams(window.location.search);
    const jobIdParam = urlParams.get("job_id") || urlParams.get("id");
    if (jobIdParam) return jobIdParam;

    // Fallback: look for a job id in elements
    const jobPostId = document.querySelector('[data-job-id]');
    if (jobPostId) return jobPostId.getAttribute('data-job-id');

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

    const jobUrl = window.location.href.split("?")[0] + (jobId ? `?job_id=${jobId}` : "");

    return {
      title,
      company_name: company,
      location,
      job_url: jobUrl,
      job_description: description,
      platform_name: "Greenhouse"
    };
  },

  // Scrape details directly from a list card (fallback to avoid loading race conditions)
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector(
      "a[href*='/jobs/'], .job-title, [class*='title']"
    );
    const companyEl = cardElement.querySelector(
      ".company, .company-name, [class*='company']"
    );
    const locationEl = cardElement.querySelector(
      ".location, [class*='location']"
    );

    const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    const company = companyEl ? companyEl.innerText.trim().split("\n")[0].trim() : "Unknown Company";
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      "li[data-job-id]",
      ".job-card",
      ".job-row",
      ".opening",
      "li.job",
      "tr.job"
    ];
    
    let initialList = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    if (initialList.length === 0) {
      // Fallback: Resolve job links to their closest parent container
      const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobs/']"));
      const uniqueParents = new Set();
      
      jobLinks.forEach(link => {
        const cardParent = link.closest("li, tr, div[class*='card'], div[class*='row'], div[class*='item']");
        const target = cardParent || link.parentElement || link;
        if (target && !uniqueParents.has(target)) {
          uniqueParents.add(target);
          initialList.push(target);
        }
      });
    }

    // Deduplicate list by job ID if possible
    const uniqueCards = [];
    const seenIds = new Set();
    
    for (const card of initialList) {
      let jobId = card.getAttribute('data-job-id') || card.getAttribute('id');
      if (!jobId) {
        const link = card.querySelector("a[href*='/jobs/']");
        if (link) {
          const match = link.href.match(/\/jobs\/(\d+)/);
          if (match) jobId = match[1];
        }
      }
      
      if (jobId) {
        if (!seenIds.has(jobId)) {
          seenIds.add(jobId);
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

    // Remove target="_blank" from any anchors to prevent opening new tabs
    const anchors = cardElement.querySelectorAll("a");
    anchors.forEach(a => a.removeAttribute("target"));
    if (cardElement.tagName === "A") {
      cardElement.removeAttribute("target");
    }

    const jobLink = cardElement.querySelector("a[href*='/jobs/']") || 
                    (cardElement.tagName === "A" && cardElement.href.includes("/jobs/") ? cardElement : null);

    if (jobLink) {
      const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
      window.clickElement(innerClickTarget);
      return true;
    }
    
    const fallbackClickable = cardElement.querySelector(".job-title, [class*='title']") || cardElement;
    if (fallbackClickable) {
      window.clickElement(fallbackClickable);
      return true;
    }

    return false;
  },

  getEasyApplyButton() {
    // Standard Greenhouse submit/apply button selectors
    const selectors = [
      "input[type='submit']#submit_app",
      "button#submit_app",
      "input[type='submit'][value*='Apply']",
      "button[type='submit']",
      "input[type='submit']",
      "[data-testid='submit-application']",
      ".submit-button",
      "button.submit"
    ];
    
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn) return btn;
    }
    
    // Find globally by text content
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || btn.innerText || btn.value || "").toLowerCase().trim();
      if (text === 'submit application' || text === 'apply now' || text === 'submit' || text === 'apply') {
        return btn;
      }
    }
    
    return null;
  },

  isAlreadyApplied() {
    const elements = Array.from(document.querySelectorAll('button, span, div, p, a, h1, h2, h3'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'application submitted' || text === 'submitted' || text.includes('applied on greenhouse')) {
          return true;
        }
      }
    }
    return false;
  },

  // Greenhouse Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Greenhouse Auto Apply initiated. Starting form auto-fill...");
      
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      
      // Helper function to find a React-Select input in the same question container
      const findReactSelectInput = (el) => {
        const isSelfReactSelect = el.classList.contains("select__input") || el.id.includes("react-select") || el.getAttribute("role") === "combobox";
        if (isSelfReactSelect) return el;

        const container = el.closest(".field-wrapper, .field, [class*='question']:not([class*='questions']), [class*='Container'], [class*='Module'], [class*='row']");
        if (!container) return null;

        return container.querySelector(".select__input, input[role='combobox'], input[id*='react-select']");
      };

      // Helper function for React-Select custom dropdowns
      const selectReactSelectOption = async (inputEl, valueText) => {
        try {
           inputEl.focus();
          const control = inputEl.closest('.select__control') || inputEl.closest('.select-shell') || inputEl.parentElement;
          const trigger = control || inputEl;
          
          trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          inputEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          trigger.click();
          inputEl.click();
          
          // Send ArrowDown key press to trigger React-Select menu open
          inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
          inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
          
          await sleep(500);

          // Wait up to 1.5 seconds for the menu to appear
          let menu = null;
          for (let i = 0; i < 5; i++) {
            const ariaControls = inputEl.getAttribute('aria-controls');
            if (ariaControls) {
              menu = document.getElementById(ariaControls);
            }
            if (!menu && inputEl.id) {
              const idPrefix = inputEl.id.replace(/-input$/, '');
              menu = document.querySelector(`[id^="${idPrefix}-menu"], [id^="${idPrefix}-listbox"], [id^="react-select-${idPrefix}-listbox"], [id$="-${idPrefix}-listbox"]`);
            }
            if (!menu) {
              menu = document.querySelector('.select__menu, .remix-css-1nmdiq5-menu');
            }
            if (!menu) {
              const menus = Array.from(document.querySelectorAll('[role="listbox"], [id*="-listbox"], [class*="-menu"]'));
              menu = menus.find(m => {
                const id = m.id || "";
                const cls = m.className || "";
                return !id.includes('iti-') && !cls.includes('iti__');
              });
            }
            if (menu) break;
            await sleep(200);
          }

          if (!menu) {
            console.warn("[AI Job Apply] Menu did not open for React-Select");
            return false;
          }
          console.log("[AI Job Apply] selectReactSelectOption: Opened menu element:", menu.tagName, "ID =", menu.id, "Class =", menu.className);

          const selectOption = () => {
            const allCandidates = Array.from(menu.querySelectorAll('[role="option"], [class*="-option"], div'));
            const options = allCandidates.filter(el => {
              const hasOptionRole = el.getAttribute('role') === 'option';
              const hasOptionClass = Array.from(el.classList).some(c => c.includes('-option'));
              if (hasOptionRole || hasOptionClass) {
                return true;
              }
              return el.tagName === 'DIV' && !el.querySelector('div');
            });
            console.log("[AI Job Apply] selectReactSelectOption: candidates =", allCandidates.length, "filtered options =", options.length);
            const targetOption = options.find(opt => {
              const optTxt = opt.innerText ? opt.innerText.toLowerCase().trim() : '';
              if (!optTxt) return false;
              const val = valueText.toLowerCase().trim();
              return optTxt === val || optTxt.includes(val) || val.includes(optTxt);
            });
            if (targetOption) {
              console.log("[AI Job Apply] selectReactSelectOption: Found and clicking option:", targetOption.innerText);
              targetOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              targetOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              targetOption.click();
              return true;
            }
            return false;
          };

          // Try to select directly first (since simple options like Yes/No are already loaded)
          if (selectOption()) {
            await sleep(300);
            return true;
          }

          // If option not found, type the value to filter/search
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(inputEl, valueText);
          } else {
            inputEl.value = valueText;
          }
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          inputEl.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(500);

          // Re-attempt selection after typing
          if (selectOption()) {
            await sleep(300);
            return true;
          }

          // Fallback keypress enter
          inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          await sleep(300);
          return true;
        } catch (err) {
          console.warn("[AI Job Apply] React-Select selection failed:", err);
          return false;
        }
      };

      // Retrieve backend authentication details from storage
      const storage = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
      const token = storage.token;
      const api = storage.apiUrl || "http://localhost:8000";

      let learnedAnswers = {};
      if (profile && profile.answers_json) {
        try {
          learnedAnswers = typeof profile.answers_json === "string" ? JSON.parse(profile.answers_json) : profile.answers_json;
          logMessage(`Loaded ${Object.keys(learnedAnswers).length} learned answers from profile.`);
        } catch (e) {
          console.warn("[AI Job Apply] Failed to parse profile answers_json:", e);
        }
      }

      let formIteration = 0;
      let previousHtml = "";

      while (checkRunning()) {
        const form = document.querySelector("form#application_form, form");
        if (!form) {
          logMessage("Form element not detected on the page. Stopping...");
          return false;
        }

        const currentHtml = form.innerHTML;
        if (currentHtml === previousHtml) {
          logMessage("Application stalled due to unanswered questions. Skipping...");
          const activeJobId = jobId || window.Connectors.Greenhouse.getJobId();
          if (activeJobId) {
            chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
          }
          return false;
        }

        previousHtml = currentHtml;
        formIteration++;
        logMessage(`Filling page ${formIteration}...`);

        // 1. Programmatic Resume Upload (if input is present)
        const resumeInput = form.querySelector("input[type='file'][id='resume'], input[type='file'][name='resume']");
        if (resumeInput && profile.resume_id && token) {
          try {
            logMessage("Fetching resume metadata...");
            const resList = await fetchBackend(`${api}/api/profiles/resumes`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            const activeResume = resList.find(r => r.id === profile.resume_id);
            const filename = activeResume ? activeResume.filename : "resume.pdf";

            logMessage(`Downloading resume: ${filename}...`);
            const downloadResult = await fetchBackend(`${api}/api/profiles/resumes/${profile.resume_id}/download`, {
              headers: { "Authorization": `Bearer ${token}` }
            });

            if (downloadResult && downloadResult.base64Data) {
              const base64Data = downloadResult.base64Data;
              const binaryString = atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              let mimeType = "application/pdf";
              if (filename.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
              else if (filename.endsWith(".doc")) mimeType = "application/msword";
              else if (filename.endsWith(".txt")) mimeType = "text/plain";

              const blob = new Blob([bytes], { type: mimeType });
              const file = new File([blob], filename, { type: mimeType });
              const dt = new DataTransfer();
              dt.items.add(file);
              resumeInput.files = dt.files;
              resumeInput.dispatchEvent(new Event("change", { bubbles: true }));
              resumeInput.dispatchEvent(new Event("input", { bubbles: true }));
              logMessage(`Attached resume: ${filename}`);
            } else {
              logMessage(`Failed to download resume file from backend.`);
            }
          } catch (err) {
            logMessage(`Failed to download/attach resume: ${err.message}`);
          }
        }

        // 2. Fill Text, Phone, Email, Textareas, and React-Select elements
        const inputs = Array.from(form.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input[type='search'], input:not([type]), textarea"));
        for (const input of inputs) {
          // Skip hidden or helper elements
          if (input.getAttribute('aria-hidden') === 'true' || input.tabIndex === -1 || input.className.includes('requiredInput') || input.offsetParent === null) {
            continue;
          }
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
          } else if (labelText.includes("first name")) {
            valueToFill = profile.first_name || "";
          } else if (labelText.includes("last name")) {
            valueToFill = profile.last_name || "";
          } else if (labelText.includes("country")) {
            let countryVal = profile.nationality || "Canada";
            const lowerVal = countryVal.toLowerCase().trim();
            if (lowerVal === "canadian") countryVal = "Canada";
            else if (lowerVal === "american") countryVal = "United States";
            else if (lowerVal === "indian") countryVal = "India";
            else if (lowerVal === "british") countryVal = "United Kingdom";
            valueToFill = countryVal;
          } else if (labelText.includes("location") || labelText.includes("city")) {
            valueToFill = "Toronto";
          } else if (labelText.includes("nationality") || labelText.includes("citizen")) {
            valueToFill = profile.nationality || "";
          } else if (labelText.includes("work authorization") || labelText.includes("legally authorized") || labelText.includes("eligible to work")) {
            valueToFill = profile.work_authorization || "Yes";
          } else if (labelText.includes("experience") && (labelText.includes("years") || labelText.includes("how many"))) {
            const skillsStr = profile.skills || "";
            const words = labelText.replace(/[^a-zA-Z0-9\s]/g, "").split(" ");
            for (const word of words) {
              if (word.length > 2 && skillsStr.toLowerCase().includes(word)) {
                const match = skillsStr.match(new RegExp(`${word}:?\\s*(\\d+)`, "i"));
                if (match) {
                  valueToFill = match[1];
                  break;
                }
              }
            }
            if (!valueToFill) valueToFill = "3";
          } else if (labelText.includes("linkedin")) {
            valueToFill = profile.linkedin || "https://linkedin.com/in/test-candidate";
          } else if (labelText.includes("github")) {
            valueToFill = profile.github || "https://github.com/test-candidate";
          } else if (labelText.includes("website") || labelText.includes("portfolio")) {
            valueToFill = profile.portfolio || "https://test-candidate.dev";
          } else if (labelText.includes("hybrid")) {
            valueToFill = "Yes";
          } else if (labelText.includes("referred")) {
            valueToFill = "No";
          } else if (labelText.includes("convicted") || labelText.includes("guilty") || labelText.includes("crime")) {
            valueToFill = "No";
          } else if (labelText.includes("salary")) {
            valueToFill = "120,000";
          } else if (labelText.includes("previously been employed")) {
            valueToFill = "No";
          } else if (labelText.includes("ai coding") || labelText.includes("claude") || labelText.includes("cursor") || labelText.includes("codex")) {
            valueToFill = "Yes";
          }

          if (valueToFill && !input.value) {
            const reactSelectEl = findReactSelectInput(input);
            if (reactSelectEl) {
              logMessage(`Selecting React-Select: "${labelText}" -> "${valueToFill}"`);
              await selectReactSelectOption(reactSelectEl, valueToFill);
            } else {
              input.value = valueToFill;
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        }

        // 3. Fill select dropdowns
        const selects = form.querySelectorAll("select");
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

        // 4. Select radio buttons
        const radioGroups = {};
        form.querySelectorAll("input[type='radio']").forEach(radio => {
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
              if (legend) labelText = legend.innerText.toLowerCase().trim();
            }
            if (!labelText) {
              labelText = getLabelText(radios[0]).toLowerCase().trim();
            }

            let matchedVal = null;
            for (const [q, a] of Object.entries(learnedAnswers)) {
              const cleanQ = q.toLowerCase().trim();
              if (labelText === cleanQ || labelText.includes(cleanQ) || cleanQ.includes(labelText)) {
                matchedVal = a;
                break;
              }
            }

            let targetVal = "yes";
            if (matchedVal !== null && matchedVal !== undefined && String(matchedVal).trim() !== "") {
              targetVal = String(matchedVal).toLowerCase().trim();
            } else if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              targetVal = (profile.visa_sponsorship === "Yes") ? "yes" : "no";
            }

            let checkIndex = 0;
            radios.forEach((r, idx) => {
              const label = getLabelText(r).toLowerCase();
              if (label === targetVal || label.includes(targetVal) || targetVal.includes(label)) {
                checkIndex = idx;
              }
            });
            radios[checkIndex].checked = true;
            radios[checkIndex].dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        // 5. Checkboxes (Auto-agree to terms)
        form.querySelectorAll("input[type='checkbox']").forEach(cb => {
          if (!cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        await sleep(600);

        const getUnfilledRequiredFields = () => {
          return Array.from(form.querySelectorAll('input, select, textarea')).filter(el => {
            if (el.type === 'hidden') return false;
            const isReq = el.required || el.getAttribute('aria-required') === 'true';
            if (!isReq) return false;

            // Skip React-Select search inputs (since they remain empty after option selection)
            // But do NOT skip the hidden required input that holds the actual selected value
            const isReactSelectSearch = el.classList.contains("select__input") || 
                                        el.getAttribute("role") === "combobox" || 
                                        (el.id && el.id.includes("react-select") && !el.className.includes("requiredInput"));
            if (isReactSelectSearch) return false;

            if (el.type === 'checkbox') return !el.checked;
            if (el.type === 'radio') {
              const name = el.name;
              if (name) {
                const radios = Array.from(form.querySelectorAll(`input[type="radio"][name="${name}"]`));
                return !radios.some(r => r.checked);
              }
              return !el.checked;
            }
            return !el.value.trim();
          });
        };

        // 6. AI Solver for remaining unanswered questions
        let emptyRequiredFields = getUnfilledRequiredFields();
        if (emptyRequiredFields.length > 0 || formIteration > 5) {
          logMessage(`Required fields empty (${emptyRequiredFields.length}) or page complex. Invoking AI Solver...`);
          try {
            const solverApi = api;
            const solverToken = token;

            if (solverToken) {
              const headingText = form.querySelector('h1, h2, h3, .app-title')?.innerText || "";
              const fieldsData = Array.from(form.querySelectorAll('input, select, textarea')).filter(el => el.type !== 'hidden').map(el => {
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
                for (const f of solveResponse.fields) {
                  let el = null;
                  if (f.id) {
                    const escapedId = f.id.replace(/:/g, '\\:');
                    el = form.querySelector(`#${escapedId}`) || document.getElementById(f.id);
                  }
                  if (!el && f.name) {
                    if (f.type === "radio") {
                      const radios = Array.from(form.querySelectorAll(`input[type="radio"][name="${f.name}"]`));
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
                      continue;
                    }
                    el = form.querySelector(`[name="${f.name}"]`);
                  }

                  if (el && f.value !== undefined && f.value !== null) {
                    const isReactSelect = el.classList.contains("select__input") || el.id.includes("react-select") || el.getAttribute("role") === "combobox";
                    if (isReactSelect) {
                      logMessage(`AI Solver filling React-Select: "${f.label}" -> "${f.value}"`);
                      await selectReactSelectOption(el, f.value);
                    } else if (el.type === "checkbox") {
                      const isTrue = f.value === true || String(f.value).toLowerCase() === "true" || String(f.value).toLowerCase() === "yes" || String(f.value).toLowerCase() === "1";
                      if (el.checked !== isTrue) {
                        el.click();
                        if (el.checked !== isTrue) {
                          el.checked = isTrue;
                          el.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                      }
                    } else if (el.type === "radio") {
                      const radios = el.name ? Array.from(form.querySelectorAll(`input[type="radio"][name="${el.name}"]`)) : [el];
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
                    } else if (el.type === "file") {
                      console.log("[AI Job Apply] AI Solver: skipping file input");
                    } else {
                      el.value = f.value;
                      el.dispatchEvent(new Event("input", { bubbles: true }));
                      el.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  }
                }
              }
            }
          } catch (solverErr) {
            console.warn("[AI Job Apply] AI Solver failed:", solverErr);
          }
        }

        // Recheck for empty fields
        const finalUnfilled = getUnfilledRequiredFields();
        if (finalUnfilled.length > 0) {
          logMessage(`Detected ${finalUnfilled.length} unfilled required fields. Skipping job...`);
          const activeJobId = jobId || window.Connectors.Greenhouse.getJobId();
          if (activeJobId) {
            chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
          }
          return false;
        }

        // 7. Submit application
        const submitBtn = window.Connectors.Greenhouse.getEasyApplyButton();
        if (submitBtn) {
          if (submitBtn.disabled) {
            logMessage("Submit button is disabled due to missing questions. Skipping job...");
            const activeJobId = jobId || window.Connectors.Greenhouse.getJobId();
            if (activeJobId) {
              chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
            }
            return false;
          }

          logMessage("Clicking submit button...");
          submitBtn.click();
          await sleep(2500);
          return true;
        } else {
          logMessage("Submit button not found. Pausing for manual submission...");
          await sleep(3000);
        }
      }
      return false;
    }
  }
};
