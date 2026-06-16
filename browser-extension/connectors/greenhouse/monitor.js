const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

console.log("=== Greenhouse Job Application Monitor (Real Chrome Edition) ===");
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
              await newPage.fill('input[type="password"], input[name="password"]', 'Password@123');
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
        await page.fill('input[type="password"], input[name="password"]', 'Password@123');
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

    console.log("Navigating to my.greenhouse.io...");
    await page.goto('https://my.greenhouse.io/', { waitUntil: 'domcontentloaded' }).catch(e => {
      console.log("Navigation warning:", e.message);
    });
    
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    const emailSelector = '#email-address, input[type="email"]';
    const isEmailVisible = await page.locator(emailSelector).isVisible({ timeout: 3000 }).catch(() => false);
    
    // Check if we are already logged in (redirected away from login page or email input is not visible)
    if (!currentUrl.includes("users/sign_in") || !isEmailVisible) {
      console.log(`Already logged in to Greenhouse (URL: ${currentUrl}). Skipping login sequence.`);
    } else {
      // 1. Enter email ID
      console.log("Entering email ID...");
      console.log(`Debug URL: ${currentUrl}`);
      console.log(`Debug Title: ${await page.title().catch(() => 'no title')}`);
      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await page.fill(emailSelector, 'kkumar.sandeep89@gmail.com');
      
      console.log("Submitting email...");
      const sendCodeBtnSelector = 'button[type="submit"]';
      await page.click(sendCodeBtnSelector);
      await page.waitForTimeout(4000);
      
      // 2. Poll OTP and fill code
      console.log("Waiting for verification code screen...");
      try {
        const otpInputSelector = 'input[id*=":-"]';
        await page.waitForSelector(otpInputSelector, { timeout: 30000 });
        
        console.log("Verification code screen loaded. Fetching JWT token from backend...");
        const token = await getBackendToken();
        console.log("Backend JWT token obtained. Polling backend for Greenhouse OTP...");
        
        const otp = await pollOtp(token);
        console.log(`Received OTP: ${otp}. Entering code...`);
        
        const inputs = page.locator(otpInputSelector);
        const count = await inputs.count();
        if (count === 8) {
          console.log("Typing OTP code character-by-character...");
          await inputs.first().focus();
          await page.keyboard.type(otp, { delay: 150 });
          await page.waitForTimeout(1000);
          
          // Verify if all inputs got filled, if not, fallback to direct fill
          for (let i = 0; i < 8; i++) {
            const val = await inputs.nth(i).inputValue();
            if (!val) {
              console.log(`Input ${i} was not filled by keyboard typing, falling back to direct fill.`);
              await inputs.nth(i).fill(otp[i]);
              await inputs.nth(i).evaluate(el => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              });
            }
          }
        } else {
          await page.keyboard.type(otp);
        }
        
        await page.waitForTimeout(1000);
        console.log("Submitting verification code...");
        const verifyBtn = page.locator('button[type="submit"]:has-text("Submit"), button:has-text("Submit")').first();
        await verifyBtn.click();
        
        console.log("Waiting for redirect after verification...");
        await page.waitForTimeout(8000);
      } catch (err) {
        console.log("OTP flow warning/error (might be already signed in or using password):", err.message);
      }
    }

    // Now trigger the auto launch turbo mode
    console.log("Signing in completed. Launching job search and Turbo Mode...");
    autoLaunchTurboMode(page, context).catch(err => {
      console.error("[AutoLaunch] Error in background launcher:", err);
    });

    autoLaunchSingleApply(page, context).catch(err => {
      console.error("[AutoLaunch] Error in single apply launcher:", err);
    });

    console.log("\n==================================================================");
    console.log("INSTRUCTIONS:");
    console.log("1. The simulation is running in the opened Chrome window.");
    console.log("2. The script will automatically log in, search for jobs, and trigger Turbo Apply.");
    console.log("3. The script will monitor the page and automatically log each step.");
    console.log("4. Press Enter or type 'c' in this terminal to trigger a manual capture.");
    console.log("==================================================================\n");

    let stepCounter = 0;
    let lastStepSignature = '';

    // Function to scan active forms
    async function scanPageForForms() {
      const activePages = context.pages().filter(p => !p.url().startsWith('chrome://') && !p.url().startsWith('about:'));
      const targetPage = activePages.find(p => p.url().includes("greenhouse.io")) || activePages[activePages.length - 1] || page;
      
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

            const heading = document.querySelector('h1, h2, h3, .app-title')?.innerText?.trim() || '';

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

    // Listen to manual triggers
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (text) => {
      const input = text.trim().toLowerCase();
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
  console.log("[AutoLaunch] Starting auto launch monitor...");
  
  let started = false;
  while (!started) {
    await page.waitForTimeout(2000);
    
    // Check current URL
    let currentUrl = page.url();
    
    // If we are on a login/SSO/sign-in page, wait
    if (currentUrl.includes("/login") || currentUrl.includes("/sign_in") || currentUrl.includes("/users/sign_in") || currentUrl.includes("/oauth") || currentUrl.includes("accounts.google.com")) {
      console.log("[AutoLaunch] Authentication/login page detected. Waiting for user login...");
      continue;
    }
    
    // Wait until we are on my.greenhouse.io
    if (!currentUrl.includes("my.greenhouse.io")) {
      console.log("[AutoLaunch] Not on my.greenhouse.io. Waiting for user to navigate to Greenhouse...");
      continue;
    }

    // Now we are logged in and on my.greenhouse.io! Let's check if the widget trigger is ready
    console.log("[AutoLaunch] Logged in to Greenhouse dashboard! Navigating to TripArc job board...");
    
    try {
      await page.goto("https://job-boards.greenhouse.io/triparc", { waitUntil: 'domcontentloaded' }).catch(e => {
        console.log("Navigation warning:", e.message);
      });
      started = true;
    } catch (e) {
      console.log("[AutoLaunch] Error navigating to job board, will retry:", e.message);
    }
  }
}

async function autoLaunchSingleApply(page, context) {
  console.log("[AutoLaunch] Starting single apply monitor...");
  let started = false;
  while (!started) {
    await page.waitForTimeout(2000);
    const activePages = context.pages().filter(p => !p.url().startsWith('chrome://') && !p.url().startsWith('about:'));
    const targetPage = activePages.find(p => p.url().includes("job-boards.greenhouse.io") || p.url().includes("boards.greenhouse.io"));
    if (!targetPage) {
      continue;
    }
    const currentUrl = targetPage.url();

    if (true) {
      console.log(`[AutoLaunch] Greenhouse job board page detected: ${currentUrl}`);
      try {
        console.log("[AutoLaunch] Finding floating AI widget trigger button...");
        const triggerSelector = '#ai-job-apply-extension-root >> .trigger-btn';
        const triggerBtn = targetPage.locator(triggerSelector);
        
        // Wait up to 10s for the trigger button to attach
        await triggerBtn.waitFor({ state: 'attached', timeout: 10000 });
        
        // Check if drawer is already open
        const drawerSelector = '#ai-job-apply-extension-root >> .drawer';
        const isOpen = await targetPage.locator(drawerSelector).evaluate(el => el.classList.contains('open')).catch(() => false);
        
        if (!isOpen) {
          console.log("[AutoLaunch] Drawer is closed. Clicking trigger button to open...");
          await triggerBtn.click();
          await targetPage.waitForTimeout(1000);
        }

        console.log("[AutoLaunch] Checking connection status...");
        const statusBadgeSelector = '#ai-job-apply-extension-root >> #connection-status';
        const statusText = await targetPage.locator(statusBadgeSelector).innerText().catch(() => "");
        console.log(`[AutoLaunch] Connection status badge: ${statusText}`);

        if (currentUrl.includes("/jobs/")) {
          console.log("[AutoLaunch] Single job page detected. Running Single Apply...");
          console.log("[AutoLaunch] Waiting for Auto Fill Application button to be visible...");
          const autofillBtnSelector = '#ai-job-apply-extension-root >> #btn-autofill-job';
          const autofillBtn = targetPage.locator(autofillBtnSelector);
          await autofillBtn.waitFor({ state: 'visible', timeout: 10000 });
          
          console.log("[AutoLaunch] Clicking 'Auto Fill Application' button...");
          await autofillBtn.click();
          console.log("[AutoLaunch] Auto Fill clicked! Form filling in progress...");
        } else {
          console.log("[AutoLaunch] Listing page detected. Running Turbo Mode...");
          
          // Apply search/office filters first
          try {
            console.log("[AutoLaunch] Applying filters on listing page...");
            const keywordInput = targetPage.locator('#keyword-filter');
            if (await keywordInput.isVisible().catch(() => false)) {
              const currentVal = await keywordInput.inputValue().catch(() => "");
              if (!currentVal.toLowerCase().includes("owner")) {
                console.log("[AutoLaunch] Typing 'Owner' in keyword filter...");
                await keywordInput.focus();
                await keywordInput.fill("Owner");
                await targetPage.waitForTimeout(1000);
              }
            }

            const officeInput = targetPage.locator('#office-filter');
            if (await officeInput.isVisible().catch(() => false)) {
              console.log("[AutoLaunch] Clicking office filter dropdown...");
              await officeInput.click();
              await targetPage.waitForTimeout(1000);

              const listboxId = 'react-select-office-filter-listbox';
              const listbox = targetPage.locator(`#${listboxId}`);
              if (await listbox.isVisible().catch(() => false)) {
                const option = targetPage.locator(`#${listboxId} >> text=TripArc`).first();
                if (await option.isVisible().catch(() => false)) {
                  console.log("[AutoLaunch] Selecting 'TripArc' option...");
                  await option.click();
                  await targetPage.waitForTimeout(2000);
                } else {
                  console.log("[AutoLaunch] 'TripArc' option not found. Pressing Escape...");
                  await targetPage.keyboard.press('Escape');
                }
              } else {
                console.log("[AutoLaunch] Office filter dropdown did not open.");
              }
            }
          } catch (filterErr) {
            console.error("[AutoLaunch] Error applying filters on listing page:", filterErr.message);
          }

          console.log("[AutoLaunch] Waiting for Turbo Tab inside drawer...");
          const turboTabSelector = '#ai-job-apply-extension-root >> #tab-btn-turbo';
          const turboTab = targetPage.locator(turboTabSelector);
          await turboTab.waitFor({ state: 'visible', timeout: 10000 });
          console.log("[AutoLaunch] Clicking Turbo tab...");
          await turboTab.click();
          
          console.log("[AutoLaunch] Waiting for Start Turbo Apply button to be enabled...");
          const startTurboBtnSelector = '#ai-job-apply-extension-root >> #btn-start-turbo';
          const startTurboBtn = targetPage.locator(startTurboBtnSelector);
          await startTurboBtn.waitFor({ state: 'visible', timeout: 10000 });
          
          for (let attempt = 0; attempt < 10; attempt++) {
            const isDisabled = await startTurboBtn.evaluate(el => el.disabled);
            if (!isDisabled) {
              console.log("[AutoLaunch] Start Turbo Apply button is enabled!");
              break;
            }
            console.log(`[AutoLaunch] Button disabled (attempt ${attempt + 1}/10), waiting for connection check...`);
            await targetPage.waitForTimeout(1000);
          }
          
          console.log("[AutoLaunch] Clicking 'Start Turbo Apply' button!");
          await startTurboBtn.click();
          console.log("[AutoLaunch] Turbo mode successfully launched! Monitoring the progress...");
        }
        started = true;
        break;
      } catch (e) {
        console.log("[AutoLaunch] Single apply/turbo trigger error (will retry):", e.message);
        if (e.message.includes("Timeout")) {
          console.log("[AutoLaunch] Timeout waiting for extension widget. Reloading target page to re-trigger injection...");
          await targetPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
    }
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
  const pollUrl = "http://localhost:8000/api/email-credentials/poll-otp?sender_filter=greenhouse&subject_filter=code";
  const timeout = 120000;
  const interval = 5000;
  const startTime = Date.now();

  console.log("Starting OTP poll from backend...");
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
