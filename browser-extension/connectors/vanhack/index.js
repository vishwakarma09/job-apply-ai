// connectors/vanhack/index.js
// VanHack Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.VanHack = {
  name: "VanHack",
  
  // Selectors for DOM extraction fallback
  selectors: {
    title: [
      "#vh-job-details-header-section > p",
      "#vh-job-details-header-section h1",
      "h1.job-title",
      "h1.title",
      "[class*='job-title']",
      "[class*='jobTitle']",
      "h1"
    ],
    company: [
      ".company-name",
      "span.company",
      "[class*='company']",
      "[class*='employer']"
    ],
    location: [
      ".job-location",
      ".location",
      "[class*='location']",
      "[class*='address']"
    ],
    description: [
      "#jobDescription",
      ".job-description",
      ".description",
      "[class*='description']",
      "[class*='desc']"
    ]
  },

  // Helper to find the details container
  getDetailsContainer() {
    return document.body;
  },

  // Extract current job ID from url or search query params
  getJobId() {
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get("job_id") || urlParams.get("jobId") || urlParams.get("id");
    if (jobId) return jobId;

    // Patterns: /jobs/(\d+), /job/(\d+)
    const match = url.match(/\/jobs\/([a-zA-Z0-9\-]+)/) || 
                  url.match(/\/job\/([a-zA-Z0-9\-]+)/);
    if (match) return match[1];

    return null;
  },

  // Scrape details of currently loaded job
  scrapeDetails(jobId) {
    let title = "Unknown Position";
    let company = "VanHack Employer";
    let location = "Remote";
    let description = "";

    // 1. Try to extract from schema.org JSON-LD first (highly robust on modern platforms)
    const jsonLdTags = document.querySelectorAll('script[type="application/ld+json"]');
    let jobPostingData = null;
    for (const tag of jsonLdTags) {
      try {
        const data = JSON.parse(tag.textContent);
        if (data["@type"] === "JobPosting" || data.title) {
          jobPostingData = data;
          break;
        }
      } catch (e) {}
    }

    if (jobPostingData) {
      title = jobPostingData.title || title;
      if (jobPostingData.hiringOrganization && jobPostingData.hiringOrganization.name) {
        company = jobPostingData.hiringOrganization.name;
      }
      if (jobPostingData.jobLocation && jobPostingData.jobLocation.address) {
        const addr = jobPostingData.jobLocation.address;
        const locality = addr.addressLocality || "";
        const region = addr.addressRegion || "";
        location = [locality, region].filter(Boolean).join(", ") || location;
      }
      description = jobPostingData.description || description;
    }

    // 2. Fallbacks if JSON-LD is missing or incomplete
    if (title === "Unknown Position") {
      for (const sel of this.selectors.title) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          title = el.innerText.trim();
          break;
        }
      }
    }

    if (company === "VanHack Employer") {
      for (const sel of this.selectors.company) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim();
          break;
        }
      }
    }

    if (location === "Remote") {
      for (const sel of this.selectors.location) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          location = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
          break;
        }
      }
    }

    if (location === "Remote" || location === "Unknown Location") {
      const flagImg = document.querySelector('img[src*="flags/4x3/"], img[src*="flag-icon-css"]');
      if (flagImg && flagImg.parentElement) {
        const parentText = flagImg.parentElement.innerText.trim();
        if (parentText) {
          location = parentText.replace(/\n/g, "").replace(/\s+/g, " ");
        }
      }
    }

    if (!description) {
      for (const sel of this.selectors.description) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          description = el.innerText.trim();
          break;
        }
      }
    }

    const jobUrl = window.location.href.split("?")[0];

    return {
      title,
      company_name: company,
      location,
      job_url: jobUrl,
      job_description: description,
      platform_name: "VanHack"
    };
  },

  // Scrape details directly from a list card
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector("a[href*='/jobs/'], a[href*='/job/'], [class*='title']");
    const companyEl = cardElement.querySelector("[class*='company'], [class*='employer']");
    const locationEl = cardElement.querySelector("[class*='location'], p");

    const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    const company = companyEl ? companyEl.innerText.trim() : "VanHack Employer";
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      'article',
      '.job-card',
      '.job-result',
      '.job_card',
      '[class*="job-card"]',
      '[class*="job-result"]',
      '[class*="job_card"]',
      'li[class*="job"]',
      'div[class*="job"]'
    ];
    
    let initialList = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    
    // Resolve job links pointing to postings/jobs
    const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobs/'], a[href*='/job/']"));
    const uniqueParents = new Set();
    
    jobLinks.forEach(link => {
      const cardParent = link.closest("article, li, tr, div[class*='card'], div[class*='row'], div[class*='item'], div[class*='job']");
      const target = cardParent || link.parentElement || link;
      if (target && !uniqueParents.has(target)) {
        uniqueParents.add(target);
        if (!initialList.includes(target)) {
          initialList.push(target);
        }
      }
    });

    // Deduplicate list by job ID
    const uniqueCards = [];
    const seenIds = new Set();
    
    for (const card of initialList) {
      let jobId = card.getAttribute('data-job-id') || card.getAttribute('id');
      if (!jobId) {
        const link = card.querySelector("a[href*='/jobs/'], a[href*='/job/']") || 
                     (card.tagName === "A" && (card.href.includes("/jobs/") || card.href.includes("/job/")) ? card : null);
        if (link) {
          const match = link.href.match(/\/jobs\/([a-zA-Z0-9\-]+)/) || 
                        link.href.match(/\/job\/([a-zA-Z0-9\-]+)/);
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

    // Remove target="_blank" to prevent opening new tabs
    const anchors = cardElement.querySelectorAll("a");
    anchors.forEach(a => a.removeAttribute("target"));
    if (cardElement.tagName === "A") {
      cardElement.removeAttribute("target");
    }

    const jobLink = cardElement.querySelector("a[href*='/jobs/'], a[href*='/job/']") || 
                    (cardElement.tagName === "A" && (cardElement.href.includes("/jobs/") || cardElement.href.includes("/job/")) ? cardElement : null);

    if (jobLink) {
      const innerClickTarget = jobLink.querySelector("span, strong, h3, h2, p") || jobLink;
      window.clickElement(innerClickTarget);
      return true;
    }
    
    cardElement.click();
    return true;
  },

  // Find and return the apply button
  getEasyApplyButton() {
    const selectors = [
      "#easy-apply-btn",
      "button[id*='apply']",
      "a[id*='apply']",
      "[class*='apply'] button",
      "[class*='apply'] a",
      "button.apply-button",
      "button.btn-apply",
      ".btn-apply"
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && window.isElementVisible(btn)) return btn;
    }
    
    // Find globally by text content
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || btn.innerText || btn.value || "").toLowerCase().trim();
      if (text === 'apply' || text === 'apply now' || text === 'easy apply' || text.includes('apply now') || text === 'quick apply' || text === 'submit application' || text === 'apply to this job' || text === 'apply for this job') {
        if (window.isElementVisible(btn)) return btn;
      }
    }
    return null;
  },

  isAlreadyApplied() {
    const elements = Array.from(document.querySelectorAll('button, span, div, p, a, h1, h2, h3'));
    for (const el of elements) {
      const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
      if (text.includes('applied successfully') || text.includes('withdraw my application') || text.includes('withdraw') || text === 'applied' || text === 'application submitted' || text === 'submitted') {
        return true;
      }
    }
    return false;
  },

  // VanHack Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("VanHack Auto Apply initiated. Starting form auto-fill...");
      
      const sleep = window.sleep;
      
      function getLabelText(el) {
        // 1. Try to find local question container on VanHack modal
        const container = el.parentElement ? el.parentElement.closest('[class*="question-item-"], [class*="question-item"]') : null;
        if (container) {
          const header = container.querySelector('div, span, label, p');
          if (header) {
            let text = header.innerText.trim();
            text = text.replace(/^\d+\.\s*/, ""); // Strip leading "1. " or "2. "
            text = text.replace(/\*$/, ""); // Strip trailing asterisk
            return text.trim();
          }
        }
        
        // 2. Fall back to standard global getLabelText
        if (window.getLabelText) {
          return window.getLabelText(el);
        }
        return "";
      }

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
        if (window.Connectors.VanHack.isAlreadyApplied()) {
          logMessage("Application submitted/confirmed successfully!");
          return true;
        }

        // Robustly detect the form or container hosting the active inputs
        let form = null;
        
        // 1. Try standard visible forms
        const forms = Array.from(document.querySelectorAll("form, [role='form']"));
        for (const f of forms) {
          if (window.isElementVisible(f)) {
            form = f;
            break;
          }
        }
        
        // 2. Try specific modal/dialog containers that are visible
        if (!form) {
          const modalSelectors = [
            ".question-modal",
            ".submit-answers-button",
            "div[role='dialog']",
            "[class*='modal']",
            "[class*='dialog']"
          ];
          for (const sel of modalSelectors) {
            const el = document.querySelector(sel);
            if (el && window.isElementVisible(el)) {
              const container = el.closest('div[class*="modal"], div[class*="dialog"], [role="dialog"], .question-modal') || el;
              if (window.isElementVisible(container)) {
                form = container;
                break;
              }
            }
          }
        }
        
        // 3. Fallback: Find closest common ancestor of the first visible input and the submit button
        if (!form) {
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
          const visibleInput = inputs.find(i => window.isElementVisible(i));
          if (visibleInput) {
            let parent = visibleInput.parentElement;
            while (parent && parent !== document.body) {
              const hasSubmit = parent.querySelector("button[type='submit'], button.submit-button, button.btn-primary, .submit-answers-button, button.submit-answers-button");
              if (hasSubmit && window.isElementVisible(hasSubmit)) {
                form = parent;
                break;
              }
              parent = parent.parentElement;
            }
            if (!form) {
              form = visibleInput.closest('div[class*="modal"], div[class*="dialog"], [role="dialog"], .question-modal') || document.body;
            }
          }
        }

        if (!form) {
          logMessage("Form element not detected on the page. Waiting for modal/page...");
          await sleep(1500);
          continue;
        }

        const currentHtml = form.innerHTML;
        if (currentHtml === previousHtml) {
          logMessage("Application form stalled. Please answer outstanding questions manually.");
          const activeJobId = jobId || window.Connectors.VanHack.getJobId();
          if (activeJobId) {
            chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
          }
          return false;
        }

        previousHtml = currentHtml;
        formIteration++;
        logMessage(`Filling page ${formIteration}...`);

        // 1. Resume Upload
        const resumeInput = form.querySelector("input[type='file'][id*='resume'], input[type='file'][name*='resume'], input[type='file'][class*='resume']");
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

              const blob = new Blob([bytes], { type: mimeType });
              const file = new File([blob], filename, { type: mimeType });
              const dt = new DataTransfer();
              dt.items.add(file);
              resumeInput.files = dt.files;
              resumeInput.dispatchEvent(new Event("change", { bubbles: true }));
              resumeInput.dispatchEvent(new Event("input", { bubbles: true }));
              logMessage(`Attached resume: ${filename}`);
            }
          } catch (err) {
            logMessage(`Resume attach failed: ${err.message}`);
          }
        }

        // 2. Fill Text, Phone, Email Inputs
        const inputs = Array.from(form.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea"));
        for (const input of inputs) {
          if (input.tabIndex === -1 || input.offsetParent === null) continue;
          const labelText = getLabelText(input).toLowerCase().trim();
          let valueToFill = "";

          // Check learned answers
          let matchedVal = null;
          if (labelText) {
            for (const [q, a] of Object.entries(learnedAnswers)) {
              const cleanQ = q.toLowerCase().trim();
              if (labelText === cleanQ || labelText.includes(cleanQ) || (cleanQ.length > 5 && cleanQ.includes(labelText))) {
                matchedVal = a;
                break;
              }
            }
          }

          if (matchedVal !== null) {
            valueToFill = matchedVal;
          } else if (labelText.includes("name") || labelText.includes("first")) {
            valueToFill = profile.name || "";
          } else if (labelText.includes("email")) {
            valueToFill = profile.email || "";
          } else if (labelText.includes("phone") || labelText.includes("tel") || labelText.includes("mobile")) {
            valueToFill = profile.phone || "";
          } else if (labelText.includes("nationality") || labelText.includes("citizen")) {
            valueToFill = profile.nationality || "";
          } else if (labelText.includes("city") || labelText.includes("location") || labelText.includes("address")) {
            valueToFill = profile.city || "";
          } else if (labelText.includes("title") || labelText.includes("role") || labelText.includes("position")) {
            valueToFill = profile.title || "";
          }

          if (valueToFill) {
            input.value = valueToFill;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            logMessage(`Filled field: "${labelText}" -> "${valueToFill}"`);
          }
        }

        // 3. Handle dropdowns/selects
        const selects = Array.from(form.querySelectorAll("select"));
        for (const select of selects) {
          if (select.tabIndex === -1 || select.offsetParent === null) continue;
          const labelText = getLabelText(select).toLowerCase().trim();
          
          let targetAnswer = "";
          if (labelText) {
            for (const [q, a] of Object.entries(learnedAnswers)) {
              const cleanQ = q.toLowerCase().trim();
              if (labelText === cleanQ || labelText.includes(cleanQ) || (cleanQ.length > 5 && cleanQ.includes(labelText))) {
                targetAnswer = a.toLowerCase().trim();
                break;
              }
            }
          }

          if (targetAnswer) {
            let matchedValue = "";
            for (const option of Array.from(select.options)) {
              const optText = option.text.toLowerCase().trim();
              if (optText === targetAnswer || optText.includes(targetAnswer) || targetAnswer.includes(optText)) {
                matchedValue = option.value;
                break;
              }
            }

            if (matchedValue) {
              select.value = matchedValue;
              select.dispatchEvent(new Event("change", { bubbles: true }));
              logMessage(`Selected option for "${labelText}" -> "${targetAnswer}"`);
            }
          }
        }

        // 3.5 Handle radio buttons
        const radioGroups = {};
        form.querySelectorAll("input[type='radio']").forEach(radio => {
          if (radio.tabIndex === -1 || radio.offsetParent === null) return;
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
            const container = radios[0].closest("fieldset, [class*='question'], [class*='Container'], [class*='Module'], div[class*='item']");
            if (container) {
              const headerEl = container.querySelector("h1, h2, h3, legend, span, label, p");
              if (headerEl) labelText = headerEl.innerText.toLowerCase().trim();
            }
            if (!labelText) {
              const legend = radios[0].closest("fieldset")?.querySelector("legend");
              if (legend) labelText = legend.innerText.toLowerCase().trim();
            }
            if (!labelText) {
              labelText = getLabelText(radios[0]).toLowerCase().trim();
            }

            let matchedVal = null;
            if (labelText) {
              for (const [q, a] of Object.entries(learnedAnswers)) {
                const cleanQ = q.toLowerCase().trim();
                if (labelText === cleanQ || labelText.includes(cleanQ) || (cleanQ.length > 5 && cleanQ.includes(labelText))) {
                  matchedVal = a;
                  break;
                }
              }
            }

            let targetVal = "yes";
            if (matchedVal !== null && matchedVal !== undefined && String(matchedVal).trim() !== "") {
              targetVal = String(matchedVal).toLowerCase().trim();
            } else if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              const profileSponsorship = (profile.visa_sponsorship || "").toLowerCase();
              targetVal = (profileSponsorship.includes("yes") || profileSponsorship.includes("require")) ? "yes" : "no";
            } else if (labelText.includes("authorized") || labelText.includes("legal") || labelText.includes("right to work")) {
              targetVal = "yes";
            }

            let checkIndex = 0;
            radios.forEach((r, idx) => {
              const label = getLabelText(r).toLowerCase().trim();
              if (label === targetVal || label.includes(targetVal) || targetVal.includes(label)) {
                checkIndex = idx;
              }
            });
            radios[checkIndex].checked = true;
            radios[checkIndex].dispatchEvent(new Event("change", { bubbles: true }));
            logMessage(`Selected radio for "${labelText}" -> "${getLabelText(radios[checkIndex])}"`);
          }
        }

        // 3.6 Handle Checkboxes
        form.querySelectorAll("input[type='checkbox']").forEach(cb => {
          if (cb.tabIndex === -1 || cb.offsetParent === null) return;
          if (!cb.checked) {
            const label = cb.closest("label");
            if (label) {
              label.click();
            } else {
              cb.click();
            }
            logMessage(`Checked checkbox: "${getLabelText(cb)}"`);
          }
        });

        // 4. Handle Submit/Next button
        const submitSelectors = [
          "button[type='submit']",
          "input[type='submit']",
          "button.submit-button",
          "button.btn-primary",
          ".btn-submit",
          "button.submit-answers-button",
          ".submit-answers-button"
        ];
        
        let submitBtn = null;
        for (const sel of submitSelectors) {
          const btn = form.querySelector(sel);
          if (btn && window.isElementVisible(btn)) {
            submitBtn = btn;
            break;
          }
        }

        if (!submitBtn) {
          // Find globally in the form by text
          const formButtons = Array.from(form.querySelectorAll("button, a, input[type='button']"));
          for (const btn of formButtons) {
            const text = (btn.textContent || btn.innerText || btn.value || "").toLowerCase().trim();
            if (text === 'submit' || text === 'submit application' || text === 'next' || text === 'continue' || text === 'send' || text === 'apply for this job' || text === 'apply') {
              if (window.isElementVisible(btn)) {
                submitBtn = btn;
                break;
              }
            }
          }
        }

        if (submitBtn) {
          const btnText = (submitBtn.textContent || submitBtn.innerText || submitBtn.value || "").trim();
          logMessage(`Clicking form action button: "${btnText}"`);
          window.clickElement(submitBtn);
          
          // Wait 3.5 seconds to see if page submits or updates
          await sleep(3500);
          
          // Check if application is complete
          if (window.location.href.includes("/confirmation") || 
              window.location.href.includes("/thank-you") || 
              document.body.innerText.toLowerCase().includes("thank you for applying") || 
              document.body.innerText.toLowerCase().includes("application submitted") || 
              document.body.innerText.toLowerCase().includes("application complete") || 
              window.Connectors.VanHack.isAlreadyApplied()) {
            logMessage("Application submitted successfully!");
            return true;
          }
        } else {
          logMessage("Submit button not found. Assuming form requires manual intervention.");
          return false;
        }
      }
      return false;
    }
  }
};
