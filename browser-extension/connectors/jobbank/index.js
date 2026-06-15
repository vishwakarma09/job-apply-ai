// connectors/jobbank/index.js
// Job Bank Canada Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.JobBank = {
  name: "Job Bank",
  
  // Selectors for DOM extraction fallback
  selectors: {
    title: [
      "h1 [itemprop='title']",
      "h1.title",
      "h1.job-title",
      "[itemprop='title']",
      "[class*='job-title']",
      "[class*='jobTitle']",
      "[class*='title']",
      "h1"
    ],
    company: [
      "span[itemprop='hiringOrganization'] span[itemprop='name']",
      "span[property='hiringOrganization']",
      "span[itemprop='name']",
      ".company",
      ".employer",
      "[class*='company']",
      "[class*='employer']",
      "h2",
      "h3"
    ],
    location: [
      "span[itemprop='jobLocation'] span[itemprop='addressLocality']",
      "span[itemprop='addressRegion']",
      ".location",
      "[class*='location']",
      "[class*='address']"
    ],
    description: [
      "#jobDescription",
      ".job-description",
      ".description",
      "div[itemprop='description']",
      "[class*='description']",
      "[class*='desc']",
      "[class*='Desc']"
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

    // Pattern: /jobposting/(\d+)
    const match = url.match(/\/jobposting\/(\d+)/) || url.match(/\/jobposting\/([a-zA-Z0-9]+)/);
    if (match) return match[1];

    return null;
  },

  // Scrape details of currently loaded job
  scrapeDetails(jobId) {
    let title = "Unknown Position";
    let company = "Job Bank Canada";
    let location = "Canada";
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

    if (company === "Job Bank Canada") {
      for (const sel of this.selectors.company) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim();
          break;
        }
      }
    }

    if (location === "Canada") {
      for (const sel of this.selectors.location) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          location = el.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ");
          break;
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
      platform_name: "Job Bank"
    };
  },

  // Scrape details directly from a list card
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector("a[href*='/jobposting/'], [class*='title']");
    const locationEl = cardElement.querySelector("[class*='location'], p");

    const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    const company = "Job Bank Canada";
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      'article',
      '.job-card',
      '.job-result',
      '[class*="job-card"]',
      '[class*="job-result"]'
    ];
    
    let initialList = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    if (initialList.length === 0) {
      // Fallback: Resolve job links pointing to postings
      const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobposting/']"));
      const uniqueParents = new Set();
      
      jobLinks.forEach(link => {
        const cardParent = link.closest("article, li, tr, div[class*='card'], div[class*='row'], div[class*='item']");
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
      let jobId = card.getAttribute('data-job-id') || card.getAttribute('id');
      if (!jobId) {
        const link = card.querySelector("a[href*='/jobposting/']") || (card.tagName === "A" && card.href.includes("/jobposting/") ? card : null);
        if (link) {
          const match = link.href.match(/\/jobposting\/([a-zA-Z0-9]+)/);
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

    const jobLink = cardElement.querySelector("a[href*='/jobposting/']") || 
                    (cardElement.tagName === "A" && cardElement.href.includes("/jobposting/") ? cardElement : null);

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
      "#showapplybtn",
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
      if (text === 'apply' || text === 'apply now' || text === 'show how to apply' || text.includes('apply now') || text === 'quick apply' || text === 'submit application' || text === 'candidater' || text.includes('apply for this job')) {
        if (window.isElementVisible(btn)) return btn;
      }
    }
    return null;
  },

  isAlreadyApplied() {
    const elements = Array.from(document.querySelectorAll('button, span, div, p, a, h1, h2, h3'));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = el.innerText ? el.innerText.trim().toLowerCase() : '';
        if (text === 'applied' || text === 'application submitted' || text === 'submitted' || text.includes('applied on job bank')) {
          return true;
        }
      }
    }
    return false;
  },

  // Job Bank Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Job Bank Auto Apply initiated. Starting form auto-fill...");
      
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      
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
        const form = document.querySelector("form, div[role='dialog'] form, .apply-form");
        if (!form) {
          logMessage("Form element not detected on the page. Waiting for modal/page...");
          await sleep(1500);
          continue;
        }

        const currentHtml = form.innerHTML;
        if (currentHtml === previousHtml) {
          logMessage("Application form stalled. Please answer outstanding fields manually.");
          const activeJobId = jobId || window.Connectors.JobBank.getJobId();
          if (activeJobId) {
            chrome.storage.local.set({ [`retry_outstanding_questions_${activeJobId}`]: true });
          }
          return false;
        }

        previousHtml = currentHtml;
        formIteration++;
        logMessage(`Filling page ${formIteration}...`);

        // 1. Resume Upload
        const resumeInput = form.querySelector("input[type='file'][id*='resume'], input[type='file'][name*='resume']");
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
          } else if (labelText.includes("city") || labelText.includes("location")) {
            valueToFill = profile.city || "Toronto";
          } else if (labelText.includes("linkedin")) {
            valueToFill = profile.linkedin || "";
          }

          if (valueToFill && !input.value) {
            input.value = valueToFill;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
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

        // 4. Fill radio buttons
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
            const container = radios[0].closest("fieldset, [class*='question'], [class*='Container']");
            if (container) {
              const headerEl = container.querySelector("legend, span, label, p");
              if (headerEl) labelText = headerEl.innerText.toLowerCase();
            }
            if (!labelText) labelText = getLabelText(radios[0]).toLowerCase().trim();

            let targetVal = "yes";
            if (labelText.includes("sponsorship") || labelText.includes("sponsor")) {
              targetVal = (profile.visa_sponsorship === "Yes") ? "yes" : "no";
            } else if (labelText.includes("authorized") || labelText.includes("work in")) {
              targetVal = "yes";
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

        // 5. Fill Checkboxes
        form.querySelectorAll("input[type='checkbox']").forEach(cb => {
          const labelText = getLabelText(cb).toLowerCase();
          if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
            cb.checked = true;
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        await sleep(1000);

        // Click next / continue / submit button
        const continueBtn = Array.from(form.querySelectorAll("button, input[type='submit']")).find(el => {
          const text = (el.innerText || el.textContent || el.value || "").toLowerCase();
          return text.includes("continue") || text.includes("next") || text.includes("submit") || text.includes("apply") || text.includes("candidater");
        });

        if (continueBtn) {
          logMessage("Advancing application form...");
          continueBtn.click();
          await sleep(2000);
        } else {
          logMessage("No continue button found. Automation stopped.");
          return false;
        }

        // Check if submission succeeded
        const success = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span")).some(el => {
          const txt = el.innerText.toLowerCase();
          return txt.includes("thank you") || txt.includes("submitted") || txt.includes("application complete") || txt.includes("success");
        });
        if (success) {
          logMessage("Application submission confirmed!");
          return true;
        }
      }
      return false;
    }
  }
};
