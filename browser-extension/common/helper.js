// common/helper.js
// Shared helper functions for AI Job Apply browser extension

window.isContextValid = function() {
  try {
    return typeof chrome !== "undefined" && 
           chrome.runtime && 
           chrome.runtime.id && 
           chrome.storage && 
           chrome.storage.local;
  } catch (e) {
    return false;
  }
};

window.fetchBackend = function(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.isContextValid()) {
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
      if (!window.isContextValid()) {
        return reject(new Error("Extension context invalidated"));
      }
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response && response.success) {
        if (response.base64Data) {
          resolve({ base64Data: response.base64Data });
        } else {
          resolve(response.data);
        }
      } else {
        reject(new Error(response ? response.error || `HTTP ${response.status}` : "Unknown proxy error"));
      }
    });
  });
};

window.debugRemoteLog = function(message) {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: "fetchBackend",
        url: `${window.API_DEFAULT_URL}/api/jobs/extension-logs`,
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

window.clickElement = (element) => {
  if (!element) return;
  
  const hasMainWorld = document.documentElement.getAttribute('data-ai-main-loaded') === 'true';
  if (hasMainWorld) {
    // Assign a unique temporary attribute
    const clickId = "click_" + Math.random().toString(36).substr(2, 9);
    element.setAttribute("data-ai-click-target", clickId);
    
    // Trigger click in MAIN world
    window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_TRIGGER_CLICK", {
      detail: { targetId: clickId }
    }));
    
    // Clean up the attribute
    element.removeAttribute("data-ai-click-target");
  } else {
    // Fallback to local dispatch in content script context
    const opts = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent("mousedown", opts));
    element.dispatchEvent(new MouseEvent("mouseup", opts));
    element.dispatchEvent(new MouseEvent("click", opts));
  }
};


window.sleep = (ms) => {
  let finalMs = ms;
  // If it's a longer sleep (likely a step delay or cooldown, not a fast poll)
  if (ms > 1000) {
    // Add random variance of -20% to +50%, plus a random extra delay between 500ms and 2500ms
    const variance = (Math.random() * 0.7 - 0.2) * ms; // -20% to +50%
    const extraHumanDelay = Math.random() * 2000 + 500; // 500ms to 2500ms
    finalMs = Math.round(ms + variance + extraHumanDelay);
    console.log(`[Human Sleep] Original: ${ms}ms -> Humanized: ${finalMs}ms`);
  }
  return new Promise(resolve => setTimeout(resolve, finalMs));
};

window.acquireConnectorLock = function(connectorName, jobId) {
  return new Promise((resolve) => {
    if (!window.isContextValid()) return resolve(false);
    const lockKey = `lock_${connectorName.toLowerCase()}`;
    const now = Date.now();
    
    chrome.storage.local.get([lockKey], (result) => {
      if (!window.isContextValid()) return resolve(false);
      const lock = result[lockKey];
      
      // If the lock is held by a different job and hasn't expired (120 seconds lease)
      if (lock && lock.jobId !== jobId && (now - lock.timestamp < 120000)) {
        resolve(false);
      } else {
        // Set lock with a unique random token to avoid race conditions
        const token = Math.random().toString(36).substring(2);
        const lockObj = { jobId, timestamp: now, token };
        chrome.storage.local.set({ [lockKey]: lockObj }, () => {
          if (!window.isContextValid()) return resolve(false);
          // Wait 50ms to verify ownership of the lock
          setTimeout(() => {
            if (!window.isContextValid()) return resolve(false);
            chrome.storage.local.get([lockKey], (verifyResult) => {
              if (!window.isContextValid()) return resolve(false);
              const verifiedLock = verifyResult[lockKey];
              if (verifiedLock && verifiedLock.token === token) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          }, 50);
        });
      }
    });
  });
};

window.releaseConnectorLock = function(connectorName, jobId) {
  return new Promise((resolve) => {
    if (!window.isContextValid()) return resolve(false);
    const lockKey = `lock_${connectorName.toLowerCase()}`;
    chrome.storage.local.get([lockKey], (result) => {
      if (!window.isContextValid()) return resolve(false);
      const lock = result[lockKey];
      if (lock && lock.jobId === jobId) {
        chrome.storage.local.remove([lockKey], () => resolve(true));
      } else {
        resolve(false);
      }
    });
  });
};


// Helper function to extract text label associated with an input
window.getLabelText = (inputEl) => {
  const doc = inputEl.ownerDocument || document;
  if (inputEl.id) {
    const label = doc.querySelector(`label[for="${inputEl.id}"]`);
    if (label) return label.innerText.trim();
  }
  const parentLabel = inputEl.closest("label");
  if (parentLabel) return parentLabel.innerText.trim();
  
  const ariaLabeledby = inputEl.getAttribute("aria-labelledby");
  if (ariaLabeledby) {
    const label = doc.getElementById(ariaLabeledby) || doc.querySelector(`#${ariaLabeledby}`);
    if (label) return label.innerText.trim();
  }

  const ariaLabel = inputEl.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  const container = inputEl.closest(".field, .field-wrapper, .fb-form-element, .jobs-easy-apply-form-section__grouping");
  if (container) {
    const title = container.querySelector("label, .artdeco-text-input--label, span, legend");
    if (title) return title.innerText.trim();
  }
  return "";
};

// Helper to visually highlight unfilled required fields in the DOM
window.highlightUnfilledFields = (unfilledFields) => {
  unfilledFields.forEach((el) => {
    let target = el;
    if (el.type === 'radio') {
      target = el.closest('fieldset') || el.parentElement;
    } else if (el.type === 'checkbox') {
      target = el.closest('label') || el;
    }

    if (target) {
      target.style.transition = "all 0.3s ease";
      target.style.border = "2px solid #ef4444";
      target.style.borderRadius = "8px";
      target.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.25)";
      
      if (target.tagName.toLowerCase() === 'fieldset' || target.tagName.toLowerCase() === 'div') {
        target.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
        target.style.padding = "8px";
      }
    }
  });

  if (unfilledFields.length > 0) {
    const firstEl = unfilledFields[0];
    const scrollTarget = firstEl.type === 'radio' ? (firstEl.closest('fieldset') || firstEl) : firstEl;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.isCloudflareChallenge = () => {
  return !!(
    document.querySelector('#challenge-running') ||
    document.querySelector('#cf-challenge') ||
    document.querySelector('#cf-wrapper') ||
    document.title.includes("Just a moment...") ||
    document.title.includes("Cloudflare") ||
    window.location.href.includes("cdn-cgi") ||
    (document.body && document.body.innerHTML && document.body.innerHTML.includes("cloudflare-static"))
  );
};

window.isElementVisible = (el) => {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 5 && rect.height > 5;
};

window.hasActiveCaptcha = () => {
  // 1. Check for visible challenge iframes (always active/unsolved if visible)
  const challengeIframes = document.querySelectorAll(
    'iframe[src*="bframe"], iframe[src*="challenge"], iframe[title*="challenge" i], iframe[title*="verification" i]'
  );
  for (const iframe of challengeIframes) {
    if (window.isElementVisible(iframe)) {
      const rect = iframe.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        return true;
      }
    }
  }

  // 2. Check for visible anchor (checkbox) iframes and check if their response is empty
  const anchorIframes = document.querySelectorAll(
    'iframe[src*="anchor"], iframe[title*="reCAPTCHA" i], iframe[title*="hCaptcha" i]'
  );
  for (const iframe of anchorIframes) {
    // Skip invisible recaptcha anchor iframes
    if (iframe.src && iframe.src.includes("size=invisible")) {
      continue;
    }
    // Skip grecaptcha badge (invisible recaptcha)
    if (iframe.closest('.grecaptcha-badge')) {
      continue;
    }
    
    if (window.isElementVisible(iframe)) {
      const rect = iframe.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        // Find the associated response textarea to see if it is solved
        const container = iframe.closest('.g-recaptcha, .h-captcha, [class*="captcha"]') || iframe.parentElement?.parentElement;
        let textarea = null;
        if (container) {
          textarea = container.querySelector('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"]');
        }
        if (!textarea) {
          // Fallback: look in the same document/shadow root
          const root = iframe.getRootNode();
          textarea = root.querySelector('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"]');
        }
        
        if (textarea && !textarea.value) {
          return true; // Unsolved visible checkbox
        }
      }
    }
  }

  // 3. Check for unsolved FriendlyCaptcha
  const friendlyCaptchaInput = document.querySelector('input[name="frc-captcha-solution"]');
  if (friendlyCaptchaInput && (!friendlyCaptchaInput.value || friendlyCaptchaInput.value.startsWith('.'))) {
    return true;
  }

  return false;
};
