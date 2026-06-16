const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

const connectorDir = __dirname;
const screenshotsDir = path.join(connectorDir, 'steps_captured');

// Clear previous step recordings on launch to ensure a clean slate
if (fs.existsSync(screenshotsDir)) {
  console.log("Cleaning up previous simulation screenshots...");
  const files = fs.readdirSync(screenshotsDir);
  for (const file of files) {
    fs.unlinkSync(path.join(screenshotsDir, file));
  }
} else {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log("=== ZipRecruiter Job Application Monitor (Real Chrome Edition) ===");
console.log(`Outputs will be saved in: ${screenshotsDir}\n`);

// Custom user profile for Chrome to persist login sessions safely
const chromeProfileDir = path.resolve(connectorDir, '../../temp_chrome_profile');
const extensionPath = path.resolve(connectorDir, '../..');

// Launch command for real Google Chrome on macOS with remote debugging and the extension loaded
const chromeCmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="${chromeProfileDir}" --load-extension="${extensionPath}"`;

console.log("Launching real Google Chrome...");
const chromeProcess = exec(chromeCmd, (err) => {
  if (err && !err.killed) {
    console.error("Chrome process error:", err);
  }
});

// Clean up Chrome when script exits
process.on('exit', () => {
  chromeProcess.kill();
});
process.on('SIGINT', () => {
  chromeProcess.kill();
  process.exit(0);
});

// Wait for Chrome to initialize, then connect Playwright
setTimeout(async () => {
  try {
    console.log("Connecting Playwright to Chrome via CDP...");
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    
    // Get default context and page
    const context = browser.contexts()[0];
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    // Stream browser console logs and errors to simulation terminal
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[Browser PageError] ${err.message}`);
    });

    context.on('page', newPage => {
      console.log(`[Browser] New tab opened: ${newPage.url()}`);
      
      // Auto login on localhost:5173
      newPage.on('framenavigated', frame => {
        if (frame === newPage.mainFrame() && (newPage.url().includes("localhost:5173") || newPage.url().includes("127.0.0.1:5173"))) {
          (async () => {
            try {
              console.log("[AutoLogin] Localhost dashboard page detected. Attempting auto-login...");
              await newPage.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
              await newPage.fill('input[type="email"], input[name="email"]', 'kkumar.sandeep89@gmail.com');
              await newPage.fill('input[type="password"], input[name="password"]', 'password');
              await newPage.click('button[type="submit"]');
              console.log("[AutoLogin] Auto-login form submitted successfully!");
            } catch (e) {
              console.log("[AutoLogin] Auto-login skipped/failed:", e.message);
            }
          })();
        }
      });

      newPage.on('console', msg => {
        console.log(`[Browser Console Subtab] ${msg.type().toUpperCase()}: ${msg.text()}`);
      });
      newPage.on('pageerror', err => {
        console.log(`[Browser PageError Subtab] ${err.message}`);
      });
    });

    console.log("Navigating to http://localhost:5173/ to check/sync credentials...");
    try {
      await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const isLoginVisible = await emailInput.isVisible({ timeout: 4000 }).catch(() => false);
      if (isLoginVisible) {
        console.log("[AutoLogin] Form visible. Logging in as kkumar.sandeep89@gmail.com...");
        await emailInput.fill('kkumar.sandeep89@gmail.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      } else {
        console.log("[AutoLogin] Already logged in or form not found. Ensuring we are on dashboard...");
      }
      
      console.log("[AutoLogin] Dashboard active. Waiting 4 seconds for extension to synchronize token...");
      await page.waitForTimeout(4000);
    } catch (e) {
      console.log("[AutoLogin] Localhost auth setup failed/skipped:", e.message);
    }

    console.log("Navigating to ZipRecruiter Sign-In page...");
    await page.goto('https://www.ziprecruiter.com/login?realm=jobseeker', { waitUntil: 'domcontentloaded' }).catch(e => {
      console.log("Navigation warning:", e.message);
    });
    
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    const emailSelector = 'input[type="email"], input[name="email"], input[id*="email"]';
    const isEmailVisible = await page.locator(emailSelector).isVisible({ timeout: 3000 }).catch(() => false);
    
    // Check if we are already logged in (redirected away from login/signin page, or email input not visible)
    const isLoginUrl = currentUrl.includes("ziprecruiter.com/login") || currentUrl.includes("ziprecruiter.com/signin") || currentUrl.includes("ziprecruiter.com/authn");
    if (!isLoginUrl || !isEmailVisible) {
      console.log(`Already logged in to ZipRecruiter (URL: ${currentUrl}). Skipping login sequence.`);
    } else {
      console.log("Entering email ID...");
      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await page.fill(emailSelector, 'kkumar.sandeep89@gmail.com');
      
      console.log("Submitting email...");
      const continueBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next"), input[type="submit"]').first();
      if (await continueBtn.count() > 0 && await continueBtn.isVisible()) {
        await continueBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(4000);
      
      // Check for Turnstile/reCAPTCHA
      let isRecaptchaVisible = await page.locator('iframe[src*="recaptcha"], .g-recaptcha, #g-recaptcha-response, iframe[src*="turnstile"]').isVisible().catch(() => false);
      if (isRecaptchaVisible) {
        console.log("[RECAPTCHA] Captcha/Turnstile detected! Please solve it in the Google Chrome window...");
        while (isRecaptchaVisible) {
          await page.waitForTimeout(2000);
          isRecaptchaVisible = await page.locator('iframe[src*="recaptcha"], .g-recaptcha, #g-recaptcha-response, iframe[src*="turnstile"]').isVisible().catch(() => false);
          const urlCheck = page.url();
          if (!urlCheck.includes("/login") && !urlCheck.includes("/signin") && !urlCheck.includes("/authn")) {
            break;
          }
        }
        console.log("Captcha solved or bypassed! Resuming login sequence...");
        await page.waitForTimeout(4000);
      }
      
      // Check for password screen
      const passwordInputSelector = 'input[type="password"]';
      const isPasswordVisible = await page.locator(passwordInputSelector).isVisible({ timeout: 2000 }).catch(() => false);
      if (isPasswordVisible) {
        console.log("Password screen visible. Entering password...");
        await page.fill(passwordInputSelector, 'password');
        const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(4000);
      }
      
      // Check for verification code screen (passcode/OTP)
      const otpInputSelector = 'input[name="otp-input"], input[id*="code"], input[name*="code"], input[id*="otp"], input[name*="otp"], input[type="tel"]';
      const isOtpVisible = await page.locator(otpInputSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (isOtpVisible) {
        console.log("Verification code screen loaded. Fetching JWT token from backend...");
        try {
          const token = await getBackendToken();
          console.log("Backend JWT token obtained. Polling backend for ZipRecruiter OTP...");
          const otp = await pollOtp(token);
          console.log(`Received OTP: ${otp}. Entering code...`);
          
          const inputs = page.locator(otpInputSelector);
          const count = await inputs.count();
          if (count === 1) {
            await inputs.fill(otp);
          } else if (count > 1) {
            for (let i = 0; i < Math.min(count, otp.length); i++) {
              await inputs.nth(i).fill(otp[i]);
            }
          } else {
            await page.keyboard.type(otp);
          }
          
          await page.waitForTimeout(1000);
          console.log("Submitting verification code...");
          const verifyBtn = page.locator('button[type="submit"]:visible, button:has-text("Verify"):visible, button:has-text("Sign in"):visible, button:has-text("Submit"):visible').first();
          await verifyBtn.click();
          
          console.log("Waiting for redirect after verification...");
          await page.waitForTimeout(8000);
        } catch (err) {
          console.log("OTP flow warning/error:", err.message);
        }
      }
    }

    console.log("Signing in completed. Launching job search and Turbo Mode...");
    autoLaunchTurboMode(page, context).catch(err => {
      console.error("[AutoLaunch] Error in autoLaunchTurboMode:", err);
    });

    let stepCounter = 0;
    let lastStepSignature = '';

    // Function to scan active forms
    async function scanPageForForms() {
      const activePages = context.pages().filter(p => !p.url().startsWith('chrome://') && !p.url().startsWith('about:'));
      const targetPage = activePages.find(p => p.url().includes("ziprecruiter")) || activePages[activePages.length - 1] || page;
      
      const frames = targetPage.frames();
      const formsFound = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        try {
          const frameData = await frame.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, select, textarea, button'));
            if (inputs.length === 0) return null;

            const getLabel = (el) => {
              if (el.id) {
                const labelEl = document.querySelector(`label[for="${el.id}"]`);
                if (labelEl) return labelEl.innerText.trim();
              }
              const parentLabel = el.closest('label');
              if (parentLabel) return parentLabel.innerText.trim();
              
              if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
              if (el.placeholder) return `[Placeholder: ${el.placeholder}]`;
              
              const prev = el.previousElementSibling;
              if (prev && (prev.tagName === 'SPAN' || prev.tagName === 'DIV' || prev.tagName === 'LABEL')) {
                return prev.innerText.trim();
              }
              
              const container = el.closest('[class*="input"], [class*="form"], [class*="question"]');
              if (container) {
                const header = container.querySelector('span, label, p, div');
                if (header && header !== el) return header.innerText.trim();
              }
              
              return '';
            };

            const heading = document.querySelector('h1, h2, h3, .app-title, [class*="Title"], [class*="title"]')?.innerText?.trim() || '';

            const fields = inputs
              .filter(el => {
                if (el.type === 'hidden') return false;
                if (el.tagName === 'BUTTON' && !['submit', 'button'].includes(el.type)) return false;
                return true;
              })
              .map(el => {
                const label = getLabel(el);
                const name = el.name || el.id || '';
                const type = el.type || el.tagName.toLowerCase();
                
                let options = [];
                if (el.tagName === 'SELECT') {
                  options = Array.from(el.options).map(opt => ({
                    text: opt.text.trim(),
                    value: opt.value
                  }));
                } else if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) {
                  options = [el.value || 'on'];
                }

                return {
                  id: el.id || '',
                  name,
                  tagName: el.tagName,
                  type,
                  label,
                  placeholder: el.placeholder || '',
                  required: el.required || el.getAttribute('aria-required') === 'true',
                  options: options.length > 0 ? options : undefined,
                  value: el.value || ''
                };
              });

            return {
              url: window.location.href,
              title: document.title,
              heading,
              fields
            };
          });

          if (frameData && frameData.fields.length > 0) {
            formsFound.push({
              frameIndex: i,
              isMainFrame: frame === targetPage.mainFrame(),
              ...frameData
            });
          }
        } catch (err) {
          // Ignore cross-origin access errors
        }
      }

      return { targetPage, formsFound };
    }

    async function captureStep(prefix, targetPage, activeForms) {
      const timestamp = Date.now();
      const screenshotPath = path.join(screenshotsDir, `${prefix}_${timestamp}.png`);
      const jsonPath = path.join(screenshotsDir, `${prefix}_${timestamp}.json`);
      
      try {
        await targetPage.screenshot({ path: screenshotPath });
        console.log(`Saved screenshot to: ${path.basename(screenshotPath)}`);

        const logData = {
          timestamp: new Date().toISOString(),
          url: targetPage.url(),
          title: await targetPage.title(),
          activeForms
        };

        fs.writeFileSync(jsonPath, JSON.stringify(logData, null, 2));
        console.log(`Saved step fields metadata to: ${path.basename(jsonPath)}`);

        for (const form of activeForms) {
          console.log(`  Frame URL: ${form.url}`);
          console.log(`  Heading: ${form.heading || '[None]'}`);
          console.log(`  Fields found (${form.fields.length}):`);
          form.fields.forEach((f, idx) => {
            const reqStr = f.required ? ' (REQUIRED)' : '';
            const labelStr = f.label ? `"${f.label}"` : '[No Label]';
            console.log(`    ${idx + 1}. ${f.tagName} [type=${f.type}, name=${f.name}]${reqStr} -> Label: ${labelStr}`);
          });
        }
        console.log("--------------------------------------------------");
      } catch (e) {
        console.error("Failed to capture step:", e.message);
      }
    }

    // Monitor Loop
    async function monitorLoop() {
      try {
        const { targetPage, formsFound } = await scanPageForForms();
        if (formsFound.length > 0) {
          const signatureParts = [];
          for (const form of formsFound) {
            signatureParts.push(form.heading);
            for (const field of form.fields) {
              signatureParts.push(`${field.name}:${field.type}:${field.label}`);
            }
          }
          const currentSignature = signatureParts.join('|');

          if (currentSignature !== lastStepSignature) {
            lastStepSignature = currentSignature;
            stepCounter++;
            console.log(`\n>>> [Step ${stepCounter} Detected] <<<`);
            await captureStep(`step_${stepCounter}`, targetPage, formsFound);
          }
        }
      } catch (err) {
        // Suppress transient errors
      }
      setTimeout(monitorLoop, 1500);
    }

    setTimeout(monitorLoop, 1000);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("Simulation console initialized. Commands: 'capture'/'c' to take step snapshot, 'exit'/'q' to quit.");
    rl.on('line', async (line) => {
      const input = line.trim().toLowerCase();
      if (input === 'exit' || input === 'q') {
        console.log("Closing Chrome and exiting...");
        chromeProcess.kill();
        process.exit(0);
      } else if (input === 'capture' || input === 'c' || input === '') {
        console.log("Triggering manual capture...");
        const { targetPage, formsFound } = await scanPageForForms();
        await captureStep("manual", targetPage, formsFound);
      }
    });

  } catch (err) {
    console.error("Failed to run monitor:", err);
    chromeProcess.kill();
  }
}, 2000);

async function autoLaunchTurboMode(page, context) {
  console.log("[AutoLaunch] Waiting for ZipRecruiter main/search page to settle...");
  await page.waitForTimeout(4000);
  
  let currentUrl = page.url();
  console.log("[AutoLaunch] Current URL:", currentUrl);
  
  // If we are on ZipRecruiter home/landing page (not search results page) or if search page lacks radius parameter, navigate directly
  const isSearchPage = currentUrl.includes("/jobs-search") || currentUrl.includes("/candidate/search") || currentUrl.includes("/c/search");
  if (!isSearchPage || (isSearchPage && !currentUrl.includes("radius="))) {
    console.log("[AutoLaunch] Not on search results page or missing radius parameter. Navigating directly to Software Developer jobs in Toronto with radius=0...");
    try {
      await page.goto("https://www.ziprecruiter.com/jobs-search?search=Software+Developer&location=Toronto%2C+ON&radius=0", { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(4000);
    } catch (e) {
      console.log("[AutoLaunch] Direct navigation failed:", e.message);
    }
  }

  // Now we should be on the search results page
  console.log("[AutoLaunch] Waiting for job cards on search results page...");
  try {
    const cardSelector = '.job_result_two_pane_v2, [class*="job_result_two_pane"], [data-testid="job-card"], .job_result, .job-result';
    await page.waitForSelector(cardSelector, { timeout: 15000 });
    
    console.log("[AutoLaunch] Finding first job card...");
    const cards = page.locator(cardSelector);
    const count = await cards.count();
    console.log(`[AutoLaunch] Found ${count} job cards.`);
    
    if (count > 0) {
      console.log("[AutoLaunch] Clicking the first job card to trigger details and widget load...");
      const firstCard = cards.first();
      // Remove target attributes first
      await firstCard.evaluate(el => {
        const anchors = el.querySelectorAll("a");
        anchors.forEach(a => a.removeAttribute("target"));
        if (el.tagName === "A") {
          el.removeAttribute("target");
        }
      });
      
      // Dismiss any blocking modals
      console.log("[AutoLaunch] Checking for overlay modals to dismiss...");
      try {
        const dismissButtons = page.locator('button:has-text("Got It"), button:has-text("Got it"), button:has-text("Close"), button[aria-label="Close"], button[class*="close"]');
        const dismissCount = await dismissButtons.count();
        for (let i = 0; i < dismissCount; i++) {
          const btn = dismissButtons.nth(i);
          if (await btn.isVisible()) {
            console.log(`[AutoLaunch] Dismissing modal by clicking button: "${await btn.innerText().catch(() => "")}"`);
            await btn.evaluate(el => el.click()).catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      } catch (err) {
        console.log("[AutoLaunch] No modals to dismiss or error dismissing:", err.message);
      }

      const jobLink = firstCard.locator("button[class*='text-left'], button[class*='text-primary'], [data-testid='job-card-title'] a, [class*='jobTitle'] a, .job_title a, a[href*='/job/']").first();
      if (await jobLink.count() > 0) {
        console.log("[AutoLaunch] Clicking job link programmatically...");
        await jobLink.evaluate(el => el.click());
      } else {
        console.log("[AutoLaunch] Clicking first card programmatically...");
        await firstCard.evaluate(el => el.click());
      }
      
      console.log("[AutoLaunch] Waiting 3 seconds for details and widget to load...");
      await page.waitForTimeout(3000);
      
      console.log("[AutoLaunch] Finding floating AI widget trigger button...");
      const triggerSelector = '#ai-job-apply-extension-root >> .trigger-btn';
      const triggerBtn = page.locator(triggerSelector);
      await triggerBtn.waitFor({ state: 'attached', timeout: 15000 });
      console.log("[AutoLaunch] Widget trigger found. Clicking it to open drawer...");
      await triggerBtn.click();
      
      console.log("[AutoLaunch] Waiting for Turbo Tab inside drawer...");
      const turboTabSelector = '#ai-job-apply-extension-root >> #tab-btn-turbo';
      const turboTab = page.locator(turboTabSelector);
      await turboTab.waitFor({ state: 'visible', timeout: 5000 });
      console.log("[AutoLaunch] Clicking Turbo tab...");
      await turboTab.click();
      
      console.log("[AutoLaunch] Waiting for Start Turbo Apply button to be enabled...");
      const startTurboBtnSelector = '#ai-job-apply-extension-root >> #btn-start-turbo';
      const startTurboBtn = page.locator(startTurboBtnSelector);
      await startTurboBtn.waitFor({ state: 'visible', timeout: 5000 });
      
      // Wait up to 10 seconds for the button to not be disabled
      for (let attempt = 0; attempt < 10; attempt++) {
        const isDisabled = await startTurboBtn.evaluate(el => el.disabled);
        if (!isDisabled) {
          console.log("[AutoLaunch] Start Turbo Apply button is enabled!");
          break;
        }
        console.log(`[AutoLaunch] Button disabled (attempt ${attempt + 1}/10), waiting for connection check...`);
        await page.waitForTimeout(1000);
      }
      
      const isRunning = await startTurboBtn.evaluate(el => el.classList.contains('danger') || el.innerText.toLowerCase().includes('stop'));
      if (isRunning) {
        console.log("[AutoLaunch] Turbo Mode is already running/resumed. Skipping click.");
      } else {
        console.log("[AutoLaunch] Clicking 'Start Turbo Apply' button!");
        await startTurboBtn.click();
      }
      console.log("[AutoLaunch] Turbo mode successfully launched/active! Monitoring the progress...");
    } else {
      console.log("[AutoLaunch] No job cards found to click.");
    }
  } catch (e) {
    console.log("[AutoLaunch] Error during auto launch sequence:", e.message);
  }
}

async function getBackendToken() {
  const loginUrl = "http://localhost:8000/api/auth/login";
  const params = new URLSearchParams();
  params.append("username", "kkumar.sandeep89@gmail.com");
  params.append("password", "password");

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Backend login failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function pollOtp(token) {
  const pollUrl = "http://localhost:8000/api/email-credentials/poll-otp?sender_filter=ziprecruiter";
  const timeout = 120000;
  const interval = 5000;
  const startTime = Date.now();

  console.log("Starting OTP poll from backend for ZipRecruiter...");
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(pollUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.otp) {
          console.log(`Successfully fetched OTP from backend: ${data.otp}`);
          return data.otp;
        }
      }
    } catch (err) {
      console.log("Error polling OTP:", err.message);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error("Timeout polling for OTP");
}
