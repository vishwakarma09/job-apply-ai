// connectors/linkedin/index.js
// LinkedIn Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.LinkedIn = {
  name: "LinkedIn",

  // Helper to query element from document or same-origin iframes
  querySelector(selector, parent = document) {
    let el = parent.querySelector(selector);
    if (el) return el;

    if (parent === document) {
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        try {
          if (iframe.contentDocument) {
            el = iframe.contentDocument.querySelector(selector);
            if (el) return el;
          }
        } catch (e) {
          // Ignore cross-origin
        }
      }
    }
    return null;
  },

  // Helper to query all elements from document and same-origin iframes
  querySelectorAll(selector, parent = document) {
    const list = [];
    parent.querySelectorAll(selector).forEach(el => list.push(el));

    if (parent === document) {
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        try {
          if (iframe.contentDocument) {
            iframe.contentDocument.querySelectorAll(selector).forEach(el => list.push(el));
          }
        } catch (e) {
          // Ignore cross-origin
        }
      }
    }
    return list;
  },
  
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
      const el = this.querySelector(sel);
      if (el && el.innerText.trim()) {
        title = el.innerText.trim();
        break;
      }
    }

    let company = "Unknown Company";
    for (const sel of this.selectors.company) {
      const el = this.querySelector(sel);
      if (el && el.innerText.trim()) {
        company = el.innerText.trim().split("\n")[0].trim();
        break;
      }
    }

    let location = "Unknown Location";
    for (const sel of this.selectors.location) {
      const el = this.querySelector(sel);
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
      const el = this.querySelector(sel);
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
    let initialList = [];
    if (containers.length > 0) {
      initialList = containers;
    } else {
      // Fallback: Resolve job view links to their closest parent container
      const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
      const uniqueParents = new Set();
      
      jobLinks.forEach(link => {
        const cardParent = link.closest("li, div[class*='card'], div[class*='item']");
        const target = cardParent || link.parentElement || link;
        if (target && !uniqueParents.has(target)) {
          uniqueParents.add(target);
          initialList.push(target);
        }
      });
    }

    // Deduplicate list by job ID
    const uniqueCards = [];
    const seenIds = new Set();
    
    for (const card of initialList) {
      let jobId = card.getAttribute('data-occludable-job-id') || card.getAttribute('data-job-id');
      if (!jobId) {
        const hasId = card.querySelector('[data-occludable-job-id], [data-job-id]');
        if (hasId) jobId = hasId.getAttribute('data-occludable-job-id') || hasId.getAttribute('data-job-id');
      }
      if (!jobId) {
        const link = card.querySelector("a[href*='/jobs/view/']");
        if (link) {
          const match = link.href.match(/\/jobs\/view\/(\d+)/);
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

    // 1. Remove target="_blank" from any anchors to prevent opening new tabs
    const anchors = cardElement.querySelectorAll("a");
    anchors.forEach(a => a.removeAttribute("target"));
    if (cardElement.tagName === "A") {
      cardElement.removeAttribute("target");
    }

    // 2. Find a job view link specifically inside the card element (or if the card itself is the link)
    const jobLink = cardElement.querySelector("a[href*='/jobs/view/']") || 
                    (cardElement.tagName === "A" && cardElement.href.includes("/jobs/view/") ? cardElement : null);

    if (jobLink) {
      // Trigger LinkedIn's internal React router by clicking the inner text span/header/strong
      const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
      window.clickElement(innerClickTarget);
      return true;
    }
    
    // 3. Fallback only if no direct job link is found (try class selectors)
    const fallbackClickable = cardElement.querySelector(".job-card-list__title, .job-card-container__link") || cardElement;
    if (fallbackClickable) {
      window.clickElement(fallbackClickable);
      return true;
    }

    // 4. Final safety click: do NOT click arbitrary "a" tags unless they are job view links
    return false;
  },

  getEasyApplyButton() {
    const detailContainers = [
      ".jobs-details",
      ".jobs-details__main-content",
      "#main",
      ".jobs-search-results-billboard__content"
    ];
    
    // Try to find the button/link inside the job details container first
    for (const containerSel of detailContainers) {
      const container = this.querySelector(containerSel);
      if (container) {
        const selectors = [
          "button.jobs-apply-button",
          "a.jobs-apply-button",
          ".jobs-apply-button button",
          ".jobs-apply-button a",
          "button[class*='easy-apply']",
          "a[class*='easy-apply']",
          "button[aria-label*='Easy Apply']",
          "a[aria-label*='Easy Apply']",
          "[data-job-id] button.jobs-apply-button",
          "[data-job-id] a.jobs-apply-button",
          "button[id*='jobs-apply-button']",
          "a[id*='jobs-apply-button']",
          "a[href*='/apply/']"
        ];
        
        for (const sel of selectors) {
          const elements = this.querySelectorAll(sel, container);
          for (const el of elements) {
            const text = (el.textContent || el.innerText || el.getAttribute("aria-label") || "").toLowerCase();
            if (text.includes("easy apply") || (el.tagName === "A" && el.href && el.href.includes("/apply/"))) {
              return el;
            }
          }
        }
      }
    }
    
    // Fallback to document-wide search, but explicitly exclude search filters
    const selectors = [
      "button.jobs-apply-button",
      "a.jobs-apply-button",
      ".jobs-apply-button button",
      ".jobs-apply-button a",
      "button[class*='easy-apply']",
      "a[class*='easy-apply']",
      "button[aria-label*='Easy Apply']",
      "a[aria-label*='Easy Apply']",
      "[data-job-id] button.jobs-apply-button",
      "[data-job-id] a.jobs-apply-button",
      "a[href*='/apply/']"
    ];
    
    for (const sel of selectors) {
      const elements = this.querySelectorAll(sel);
      for (const el of elements) {
        // Exclude search filter buttons
        if (el.id && el.id.includes("searchFilter")) continue;
        if (el.name && el.name.includes("searchFilter")) continue;
        const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
        if (ariaLabel.includes("filter")) continue;
        
        const text = (el.textContent || el.innerText || ariaLabel).toLowerCase();
        if (text.includes("easy apply") || (el.tagName === "A" && el.href && el.href.includes("/apply/"))) {
          return el;
        }
      }
    }
    return null;
  },

  isAlreadyApplied() {
    const elements = Array.from(this.querySelectorAll('button, span, div, p, a'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'applied on linkedin' || text === 'application submitted') {
          return true;
        }
      }
    }
    return false;
  },

  // LinkedIn-specific Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Waiting for Easy Apply modal to load...");
      
      let modal = null;
      // Poll for up to 6 seconds (12 * 500ms)
      for (let i = 0; i < 12; i++) {
        if (!checkRunning()) return false;
        modal = window.Connectors.LinkedIn.querySelector(".jobs-easy-apply-modal, div[role='dialog'], [class*='easy-apply-modal']");
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
        const currentModal = window.Connectors.LinkedIn.querySelector(".jobs-easy-apply-modal, div[role='dialog']");
        if (!currentModal) {
          logMessage("Easy Apply modal closed. Form finished.");
          return true;
        }

        // Check if we are on the same page loop to avoid getting stuck in a loop
        const currentHtml = currentModal.innerHTML;
        if (currentHtml === previousHtml) {
          logMessage("Application stalled due to unanswered questions. Skipping job...");
          const activeJobId = jobId || window.Connectors.LinkedIn.getJobId();
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

        // 1. Fill Text Inputs & Textareas
        const inputs = currentModal.querySelectorAll("input[type='text'], input[type='tel'], input:not([type]), textarea");
        inputs.forEach(input => {
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
          } else if (labelText.includes("city") || labelText.includes("location") || labelText.includes("address")) {
            valueToFill = profile.city || "";
          } else if (labelText.includes("title") || labelText.includes("role") || labelText.includes("position")) {
            valueToFill = profile.title || "";
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
            const labelText = getLabelText(select).toLowerCase().trim();
            let targetVal = "";

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
            if (legend) labelText = legend.innerText.toLowerCase().trim();
            if (!labelText) {
              labelText = getLabelText(radios[0]).toLowerCase().trim();
            }

            // Check learned answers first
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

        // Helper to get all current unfilled required fields
        const getUnfilledRequiredFields = () => {
          return Array.from(currentModal.querySelectorAll('input, select, textarea')).filter(el => {
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
        };

        // Check for unfilled required fields in LinkedIn's modal and trigger AI Solver
        let emptyRequiredFields = getUnfilledRequiredFields();
        if (emptyRequiredFields.length > 0 || formIteration > 5) {
          logMessage(`Required fields empty (${emptyRequiredFields.length}) or page complex. Invoking AI Solver...`);
          try {
            const chromeData = await new Promise(r => chrome.storage.local.get(["token", "apiUrl"], r));
            const solverApi = chromeData.apiUrl || window.API_DEFAULT_URL;
            const solverToken = chromeData.token;

            if (solverToken) {
              const headingText = currentModal.querySelector('h1, h2, h3, .artdeco-modal__title')?.innerText || "";
              const fieldsData = Array.from(currentModal.querySelectorAll('input, select, textarea')).filter(el => el.type !== 'hidden').map(el => {
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
                  title: currentModal.ownerDocument.title,
                  heading: headingText,
                  fields: fieldsData
                })
              });

              if (solveResponse && solveResponse.action === "fill" && solveResponse.fields) {
                logMessage("AI Solver successfully resolved fields.");
                solveResponse.fields.forEach(f => {
                  let el = null;
                  if (f.id) {
                    // Escape colon in ID selector
                    const escapedId = f.id.replace(/:/g, '\\:');
                    el = currentModal.querySelector(`#${escapedId}`) || currentModal.ownerDocument.getElementById(f.id);
                  }
                  if (!el && f.name) {
                    if (f.type === "radio") {
                      const radios = Array.from(currentModal.querySelectorAll(`input[type="radio"][name="${f.name}"]`));
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
                    el = currentModal.querySelector(`[name="${f.name}"]`);
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
                      const radios = el.name ? Array.from(currentModal.querySelectorAll(`input[type="radio"][name="${el.name}"]`)) : [el];
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
              }
            }
          } catch (solverErr) {
            console.warn("[AI Job Apply] AI Solver failed:", solverErr);
          }
        }

        // Re-check unfilled required fields after AI Solver has run
        try {
          const finalUnfilled = getUnfilledRequiredFields();
          if (finalUnfilled.length > 0) {
            logMessage(`Detected ${finalUnfilled.length} unfilled required fields. Skipping job...`);
            const activeJobId = jobId || window.Connectors.LinkedIn.getJobId();
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
        let nextBtn = currentModal.querySelector("button.artdeco-button--primary");
        if (!nextBtn) {
          const buttons = Array.from(currentModal.querySelectorAll("button, footer button"));
          nextBtn = buttons.find(btn => {
            const text = btn.innerText.toLowerCase();
            const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
            const isBack = text.includes("back") || text.includes("previous") || aria.includes("back") || aria.includes("previous");
            if (isBack) return false;
            return btn.classList.contains("artdeco-button--primary") || 
                   btn.type === "submit" || 
                   text.includes("next") || 
                   text.includes("review") || 
                   text.includes("submit") || 
                   text.includes("continue");
          });
        }
        if (!nextBtn) {
          nextBtn = currentModal.querySelector("button.artdeco-button--primary, button[class*='primary'], footer button");
        }
        if (nextBtn) {
          const btnText = nextBtn.innerText.toLowerCase();
          
          if (nextBtn.disabled) {
            logMessage("Form button is disabled due to missing questions. Skipping job...");
            const activeJobId = jobId || window.Connectors.LinkedIn.getJobId();
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
            
            const dismissBtn = currentModal.ownerDocument.querySelector("button[aria-label='Dismiss'], button[aria-label='Close'], .artdeco-modal__dismiss");
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
};
