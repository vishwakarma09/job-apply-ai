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

console.log("=== Indeed Job Application Monitor (Real Chrome Edition) ===");
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
  let browser;
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Connecting Playwright to Chrome via CDP (attempt ${attempt}/${maxAttempts})...`);
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      break;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error("Failed to run monitor:", err);
        chromeProcess.kill();
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  try {
    // Get default context and page
    const context = browser.contexts()[0];
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }
    // Cookies will not be cleared so that we can reuse the existing logged-in session.

    // Stream browser console logs and errors to simulation terminal
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[Browser PageError] ${err.message}`);
    });

    context.on('page', newPage => {
      console.log(`[Browser] New tab opened: ${newPage.url()}`);
      newPage.on('console', msg => {
        console.log(`[Browser Console Subtab] ${msg.type().toUpperCase()}: ${msg.text()}`);
      });
      newPage.on('pageerror', err => {
        console.log(`[Browser PageError Subtab] ${err.message}`);
      });
    });

    console.log("Navigating to local dashboard to sync extension token...");
    try {
      await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const hostEmailInput = page.locator('input[type="email"]');
      const hostPasswordInput = page.locator('input[type="password"]');
      if (await hostEmailInput.isVisible({ timeout: 5000 })) {
        console.log("Logging in to local dashboard...");
        await hostEmailInput.fill('kkumar.sandeep89@gmail.com');
        await hostPasswordInput.fill('password');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(4000);
        console.log("Dashboard login complete, extension token synchronized.");
      }
    } catch (e) {
      console.log("Dashboard navigation/login skipped or failed:", e.message);
    }

    console.log("Navigating to Indeed Sign-In page...");
    await page.goto('https://secure.indeed.com/auth', { waitUntil: 'domcontentloaded' }).catch(e => {
      console.log("Navigation warning:", e.message);
    });
    
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    const emailSelector = 'input[type="email"], input[name="__email"], input[id*="email"]';
    const isEmailVisible = await page.locator(emailSelector).isVisible({ timeout: 3000 }).catch(() => false);
    
    // Check if we are already logged in (redirected away from login page or email input is not visible)
    if ((!currentUrl.includes("secure.indeed.com/auth") && !currentUrl.includes("secure.indeed.com/account/login")) || !isEmailVisible) {
      console.log(`Already logged in to Indeed (URL: ${currentUrl}). Skipping login sequence.`);
    } else {
      // 1. Enter email ID
      console.log("Entering email ID...");
      console.log(`Debug URL: ${currentUrl}`);
      console.log(`Debug Title: ${await page.title().catch(() => 'no title')}`);
      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await page.fill(emailSelector, 'kkumar.sandeep89@gmail.com');
      
      console.log("Submitting email...");
      const submitBtnSelector = 'button[type="submit"]';
      await page.click(submitBtnSelector);
      await page.waitForTimeout(4000);
      
      // 2. Check for reCAPTCHA or security checks
      let isRecaptchaVisible = await page.locator('iframe[src*="recaptcha"], .g-recaptcha, #g-recaptcha-response').isVisible().catch(() => false);
      if (isRecaptchaVisible) {
        console.log("[RECAPTCHA] reCAPTCHA detected! Please solve the captcha in the Google Chrome window...");
        while (isRecaptchaVisible) {
          await page.waitForTimeout(2000);
          isRecaptchaVisible = await page.locator('iframe[src*="recaptcha"], .g-recaptcha, #g-recaptcha-response').isVisible().catch(() => false);
          const urlCheck = page.url();
          if (!urlCheck.includes("/auth") || urlCheck.includes("/postauthfunnel")) {
            break;
          }
        }
        console.log("reCAPTCHA solved or bypassed! Resuming login sequence...");
        await page.waitForTimeout(4000);
      }
      
      // 3. Check for password screen vs OTP code option
      const useCodeBtn = page.locator('button:has-text("code"), a:has-text("code"), button:has-text("link"), a:has-text("link"), [class*="link"]:has-text("code")');
      if (await useCodeBtn.count() > 0) {
        console.log("Clicking 'Send a login code' / 'Sign in with code' option...");
        await useCodeBtn.first().click();
        await page.waitForTimeout(4000);
      } else {
        const passwordInputSelector = 'input[type="password"]';
        const isPasswordVisible = await page.locator(passwordInputSelector).isVisible({ timeout: 2000 }).catch(() => false);
        if (isPasswordVisible) {
          console.log("Password screen visible. Trying password fallback...");
          await page.fill(passwordInputSelector, 'password');
          await page.click('button[type="submit"]');
          await page.waitForTimeout(4000);
        }
      }
      
      // 4. Poll OTP and fill code
      console.log("Waiting for verification code screen...");
      try {
        const otpInputSelector = 'input[type="text"], input[type="tel"], input[id*="code"], input[name*="code"]';
        await page.waitForSelector(otpInputSelector, { timeout: 30000 });
        
        console.log("Verification code screen loaded. Fetching JWT token from backend...");
        const token = await getBackendToken();
        console.log("Backend JWT token obtained. Polling backend for OTP...");
        
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
        const verifyBtn = page.locator('button[type="submit"]:visible, button:has-text("Verify"):visible, button:has-text("Sign in"):visible').first();
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
      // Re-fetch active pages in case the tab was changed or closed
      const activePages = context.pages();
      // Use the last active page or the current one
      const targetPage = activePages[activePages.length - 1] || page;
      
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
              
              const container = el.closest('.css-0, .css-1, .icl-TextInput, .icl-Select, [class*="input"], [class*="form"]');
              if (container) {
                const header = container.querySelector('span, label, p, div');
                if (header && header !== el) return header.innerText.trim();
              }
              
              return '';
            };

            const heading = document.querySelector('h1, h2, h3, .ia-JobApplicationSteps-title')?.innerText?.trim() || '';

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
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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
  console.log("[AutoLaunch] Waiting for Indeed main/search page to settle...");
  await page.waitForTimeout(4000);
  
  let currentUrl = page.url();
  console.log("[AutoLaunch] Current URL:", currentUrl);
  
  // If we are on Indeed home/landing page (not search results page) or if we are on a search page without a radius limit, navigate directly or perform search
  const isSearchPage = currentUrl.includes("/jobs") || currentUrl.includes("/viewjob") || currentUrl.includes("/rc/clk");
  if (!isSearchPage || (currentUrl.includes("/jobs") && !currentUrl.includes("radius="))) {
    console.log("[AutoLaunch] Not on search results page or missing radius parameter. Navigating directly to Forward deployed engineer jobs in Toronto with radius=0...");
    try {
      await page.goto("https://www.indeed.com/jobs?q=Forward+deployed+engineer&l=Toronto%2C+ON&radius=0", { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(4000);
    } catch (e) {
      console.log("[AutoLaunch] Direct navigation failed, trying home page form fallback:", e.message);
      try {
        const qInput = page.locator('input[name="q"]');
        await qInput.waitFor({ timeout: 5000 });
        await qInput.fill("Forward deployed engineer");
        
        const lInput = page.locator('input[name="l"]');
        if (await lInput.count() > 0) {
          await lInput.click();
          await page.keyboard.press('Meta+A');
          await page.keyboard.press('Backspace');
          await lInput.fill("Toronto, ON");
        }
        
        console.log("[AutoLaunch] Submitting search form...");
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(() => {});
        
        let postFallbackUrl = page.url();
        if (postFallbackUrl.includes("/jobs") && !postFallbackUrl.includes("radius=")) {
          console.log("[AutoLaunch] Fallback loaded without radius, appending &radius=0...");
          await page.goto(postFallbackUrl + "&radius=0", { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (err) {
        console.log("[AutoLaunch] Fallback search failed or timed out:", err.message);
      }
    }
  }

  // Now we should be on the search results page
  console.log("[AutoLaunch] Waiting for job cards on search results page...");
  try {
    const cardSelector = '.job_seen_beacon, .result, [data-jk]';
    await page.waitForSelector(cardSelector, { timeout: 15000 });
    
    console.log("[AutoLaunch] Finding first job card...");
    const cards = page.locator(cardSelector);
    const count = await cards.count();
    console.log(`[AutoLaunch] Found ${count} job cards.`);
    
    if (count > 0) {
      console.log("[AutoLaunch] Clicking the first job card to trigger details and widget load...");
      const firstCard = cards.first();
      const jobLink = firstCard.locator('a[data-jk], a').first();
      if (await jobLink.count() > 0) {
        await jobLink.click();
      } else {
        await firstCard.click();
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
      
      // Wait up to 10 seconds for the button to not be disabled (connected to backend status)
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
  const pollUrl = "http://localhost:8000/api/email-credentials/poll-otp?sender_filter=indeed&subject_filter=code";
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
