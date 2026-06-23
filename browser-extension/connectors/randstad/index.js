// connectors/randstad/index.js
// Randstad Platform Connector for AI Job Apply

window.Connectors = window.Connectors || {};

window.Connectors.Randstad = {
  name: "Randstad",
  
  // Selectors for DOM extraction fallback
  selectors: {
    title: [
      "h1",
      "h1.rel_text-heading-lg",
      "h1.job-title",
      "[class*='job-title']",
      "[class*='jobTitle']",
      "[class*='title']"
    ],
    company: [
      "[class*='company']",
      ".company-name"
    ],
    location: [
      "p.rel_text-paragraph-sm",
      "[class*='location']"
    ],
    description: [
      ".job-description",
      "[class*='description']",
      "div.rel_wysiwyg"
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
    const jobId = urlParams.get("job_id") || urlParams.get("jobId");
    if (jobId) return jobId;

    // Pattern: /jobs/<slug>_<jobId>/ or similar
    const match = url.match(/_([a-zA-Z0-9]+)\/?$/) || url.match(/_([a-zA-Z0-9]+)\b/);
    if (match) return match[1];

    return null;
  },

  // Scrape details of currently loaded job
  scrapeDetails(jobId) {
    let title = "Unknown Position";
    let company = "Randstad Canada";
    let location = "Canada";
    let description = "";

    // 1. Try to extract from schema.org JSON-LD first (highly robust on Randstad)
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
      platform_name: "Randstad"
    };
  },

  // Scrape details directly from a list card
  scrapeCardDetails(cardElement) {
    if (!cardElement) return null;
    
    const titleEl = cardElement.querySelector("a[href*='/jobs/'], [class*='title']");
    const locationEl = cardElement.querySelector("[class*='location'], p");

    const title = titleEl ? titleEl.innerText.trim() : "Unknown Position";
    const company = "Randstad Canada";
    const location = locationEl ? locationEl.innerText.trim().replace(/\n/g, "").replace(/\s+/g, " ") : "Unknown Location";

    return { title, company, location };
  },

  // Returns array of clickable job card list elements from search results
  getJobCards() {
    const containerSelectors = [
      '.job-card',
      '.job-item',
      '.rel_c_jobcard',
      '.rel_c_card',
      '[class*="job-card"]',
      '[class*="jobcard"]'
    ];
    
    let initialList = Array.from(document.querySelectorAll(containerSelectors.join(",")));
    if (initialList.length === 0) {
      // Fallback: Resolve job links pointing to postings
      const jobLinks = Array.from(document.querySelectorAll("a[href*='/jobs/']")).filter(link => {
        const pathname = link.pathname || "";
        return pathname.match(/\/jobs\/[^/]+_\d+\/?$/) || pathname.match(/\/jobs\/[^/]+-\d+\/?$/);
      });
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
        const link = card.querySelector("a[href*='/jobs/']");
        if (link) {
          const match = link.href.match(/_([a-zA-Z0-9]+)\/?$/) || link.href.match(/_([a-zA-Z0-9]+)\b/);
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

    const jobLink = cardElement.querySelector("a[href*='/jobs/']") || 
                    (cardElement.tagName === "A" && cardElement.href.includes("/jobs/") ? cardElement : null);

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
      "a[href*='/apply/']",
      "button[id*='apply']",
      "a[id*='apply']",
      "[class*='apply'] button",
      "[class*='apply'] a",
      "button.apply-button",
      "button.btn-apply"
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && window.isElementVisible(btn)) return btn;
    }
    
    // Find globally by text content
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || btn.innerText || btn.value || "").toLowerCase().trim();
      if (text === 'apply' || text === 'apply now' || text === 'quick apply' || text === 'submit application' || text === 'candidater' || text.includes('apply for this job')) {
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
        if (text === 'applied' || text === 'application submitted' || text === 'submitted' || text.includes('applied on randstad')) {
          return true;
        }
      }
    }
    return false;
  },

  // Randstad Easy Apply workflow automation
  EasyApply: {
    async automate(profile, logMessage, checkRunning, jobId = null) {
      logMessage("Randstad Auto Apply initiated. Starting form auto-fill...");
      
      const sleep = window.sleep;

      const setNativeValue = (element, value) => {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        
        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
          prototypeValueSetter.call(element, value);
        } else if (valueSetter) {
          valueSetter.call(element, value);
        } else {
          element.value = value;
        }
      };

      const setNativeChecked = (element, checked) => {
        const checkedSetter = Object.getOwnPropertyDescriptor(element, 'checked')?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeCheckedSetter = Object.getOwnPropertyDescriptor(prototype, 'checked')?.set;
        
        if (prototypeCheckedSetter && checkedSetter !== prototypeCheckedSetter) {
          prototypeCheckedSetter.call(element, checked);
        } else if (checkedSetter) {
          checkedSetter.call(element, checked);
        } else {
          element.checked = checked;
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
        // Target #applicationForm and ignore newsletter/job alerts signup forms
        const form = document.querySelector("#applicationForm");
        const hasVisibleFields = form && Array.from(form.querySelectorAll("input, select, textarea, button")).some(el => {
          return el.offsetWidth > 0 && el.offsetHeight > 0;
        });

        if (!hasVisibleFields) {
          logMessage("Application form fields not visible yet. Waiting for modal/page...");
          await sleep(1500);
          continue;
        }

        if (window.hasActiveCaptcha && window.hasActiveCaptcha()) {
          logMessage("CAPTCHA detected on page! Pausing automation for manual resolution...");
          
          try {
            const captchaInput = document.querySelector('input[name="frc-captcha-solution"]');
            if (captchaInput && (captchaInput.value === '.UNSTARTED' || captchaInput.value === '.EXPIRED')) {
              const captchaWidget = document.querySelector('.bluex-friendly-captcha, .frc-captcha, [class*="captcha"]');
              if (captchaWidget) {
                logMessage("[AI Job Apply] FriendlyCaptcha detected unstarted. Scrolling into view...");
                captchaWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(1000);
                const startBtn = captchaWidget.querySelector('button');
                if (startBtn && startBtn.innerText.toLowerCase().includes('start')) {
                  logMessage("[AI Job Apply] Auto-clicking FriendlyCaptcha start button...");
                  startBtn.click();
                }
              }
            }
          } catch (e) {
            console.warn("[AI Job Apply] Error handling FriendlyCaptcha automation:", e);
          }

          await sleep(3000);
          continue;
        }

        // Prevent infinite loops on static forms
        const currentHtml = form.innerHTML;
        if (currentHtml === previousHtml) {
          formIteration++;
          if (formIteration > 3) {
            logMessage("Form hasn't updated after multiple attempts. Stopping to prevent loop.");
            return false;
          }
        } else {
          formIteration = 0;
          previousHtml = currentHtml;
        }

        logMessage(`Filling page ${formIteration + 1}...`);

        // 1. Resume Upload
        const resumeInput = form.querySelector("input[type='file'][id*='resume'], input[type='file'][name*='resume']") || form.querySelector("input[type='file']");
        if (resumeInput && profile.resume_id && token) {
          try {
            logMessage("Fetching resume metadata...");
            const resList = await fetchBackend(`${api}/api/profiles/resumes`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            const dbResume = resList.find(r => r.id === profile.resume_id);
            if (dbResume) {
              logMessage(`Downloading resume: ${dbResume.filename}...`);
              const downloadResult = await fetchBackend(`${api}/api/profiles/resumes/${profile.resume_id}/download`, {
                headers: { "Authorization": `Bearer ${token}` }
              });
              if (downloadResult && downloadResult.base64Data) {
                // Convert base64 to binary array
                const binaryStr = atob(downloadResult.base64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: "application/pdf" });
                const file = new File([blob], dbResume.filename, { type: "application/pdf" });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                resumeInput.files = dataTransfer.files;
                resumeInput.dispatchEvent(new Event("change", { bubbles: true }));
                logMessage(`Attached resume file: ${dbResume.filename}`);
                await sleep(1500);
              } else {
                logMessage("No resume download data returned.");
              }
            } else {
              logMessage("Resume not found in active profile list.");
            }
          } catch (err) {
            logMessage(`Resume attach failed: ${err.message}`);
          }
        }

        // 2. Fill Text, Phone, Email, Password Inputs
        const inputs = Array.from(form.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input[type='password'], input:not([type]), textarea"));
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
            let cleanPhone = (profile.phone || "").replace(/\D/g, "");
            if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
              cleanPhone = cleanPhone.substring(1);
            }
            valueToFill = cleanPhone || "6473950215";
          } else if (labelText.includes("email")) {
            valueToFill = profile.email || "";
          } else if (labelText.includes("first name") || labelText.includes("given name")) {
            valueToFill = profile.first_name || "";
          } else if (labelText.includes("last name") || labelText.includes("family name")) {
            valueToFill = profile.last_name || "";
          } else if (labelText.includes("city") || labelText.includes("location") || labelText.includes("address")) {
            valueToFill = profile.city || "";
          } else if (labelText.includes("title") || labelText.includes("role") || labelText.includes("position")) {
            valueToFill = profile.title || "";
          } else if (labelText.includes("linkedin")) {
            valueToFill = profile.linkedin || "";
          } else if (labelText.includes("password") || input.type === "password") {
            valueToFill = "Password@123";
          }

          if (valueToFill !== undefined && valueToFill !== null && valueToFill !== "") {
            if (input.value !== valueToFill) {
              logMessage(`Filling field (${labelText} / name: ${input.name || ''}) -> ${valueToFill}`);
              setNativeValue(input, valueToFill);
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
            } else if (labelText.includes("country")) {
              targetVal = "canada";
            } else if (labelText.includes("province") || labelText.includes("state")) {
              targetVal = "ontario";
            }

            if (targetVal) {
              const bestOption = Array.from(select.options).find(opt => {
                const optText = opt.text.toLowerCase();
                const optVal = opt.value.toLowerCase();
                return optText.includes(targetVal) || optVal.includes(targetVal) || targetVal.includes(optText);
              });
              if (bestOption) {
                select.value = bestOption.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                select.dispatchEvent(new Event("input", { bubbles: true }));
                logMessage(`Selected option for ${labelText}: ${bestOption.text}`);
              }
            }
          }
        });

        // 4. Fill radio buttons
        const fieldsets = form.querySelectorAll("fieldset, div[role='radiogroup']");
        for (const container of fieldsets) {
          const radios = container.querySelectorAll("input[type='radio']");
          if (radios.length > 0) {
            const titleEl = container.querySelector("legend, span, label, p");
            const titleText = titleEl ? titleEl.innerText.toLowerCase() : "";
            
            let targetVal = "";
            let matchedVal = null;
            for (const [q, a] of Object.entries(learnedAnswers)) {
              const cleanQ = q.toLowerCase().trim();
              if (titleText === cleanQ || titleText.includes(cleanQ) || cleanQ.includes(titleText)) {
                matchedVal = a;
                break;
              }
            }

            if (matchedVal !== null && matchedVal !== undefined) {
              targetVal = String(matchedVal).toLowerCase();
            } else if (titleText.includes("sponsorship") || titleText.includes("sponsor")) {
              targetVal = "no";
            } else if (titleText.includes("authorized") || titleText.includes("legally")) {
              targetVal = "yes";
            }

            if (targetVal) {
              let checkIndex = -1;
              radios.forEach((r, idx) => {
                const labelText = getLabelText(r).toLowerCase();
                if (labelText.includes(targetVal) || targetVal.includes(labelText)) {
                  checkIndex = idx;
                }
              });

              if (checkIndex !== -1 && !radios[checkIndex].checked) {
                window.clickElement(radios[checkIndex]);
                if (!radios[checkIndex].checked) {
                  radios[checkIndex].checked = true;
                  radios[checkIndex].dispatchEvent(new Event("change", { bubbles: true }));
                }
                logMessage(`Checked radio button for ${titleText}: ${getLabelText(radios[checkIndex])}`);
              }
            }
          }
        }

        // 5. Fill Checkboxes
        form.querySelectorAll("input[type='checkbox']").forEach(cb => {
          const labelText = getLabelText(cb).toLowerCase();
          if (!cb.checked && (labelText.includes("agree") || labelText.includes("terms") || labelText.includes("accept") || labelText.includes("policy"))) {
            setNativeChecked(cb, true);
            window.clickElement(cb);
            logMessage(`Checked checkbox: ${labelText}`);
          }
        });

        await sleep(1000);

        // Click next / continue / submit button
        const continueBtn = Array.from(form.querySelectorAll("button, input[type='submit']")).find(el => {
          const text = (el.innerText || el.textContent || el.value || "").toLowerCase();
          return text.includes("continue") || text.includes("next") || text.includes("submit") || text.includes("apply") || text.includes("candidater") || el.id === "apply-button";
        });

        if (continueBtn) {
          logMessage("Advancing application form...");
          window.clickElement(continueBtn);
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
