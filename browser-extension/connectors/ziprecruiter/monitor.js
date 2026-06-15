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

    console.log("Navigating to www.ziprecruiter.com...");
    await page.goto('https://www.ziprecruiter.com/', { waitUntil: 'domcontentloaded' }).catch(e => {
      console.log("Navigation warning:", e.message);
    });

    console.log("\n==================================================================");
    console.log("INSTRUCTIONS FOR USER:");
    console.log("1. Please log in to your ZipRecruiter account in the newly opened Chrome window.");
    console.log("2. Reload the AI Job Apply Assistant extension in Chrome:");
    console.log("   Go to chrome://extensions/, find 'AI Job Apply Assistant', and click reload.");
    console.log("3. Navigate to a ZipRecruiter job search page (e.g. searching for Software Engineer).");
    console.log("4. Once logged in and on the search page, press ENTER in this terminal to continue.");
    console.log("==================================================================\n");

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => rl.once('line', resolve));
    console.log("Resuming simulation... Initializing ZipRecruiter automation sequence.");
    console.log("Navigating target page to Customer Service jobs search page...");
    await page.goto('https://www.ziprecruiter.com/jobs-search?search=Customer+Service&location=Toronto%2C+ON', { waitUntil: 'domcontentloaded' }).catch(() => {});

    // Auto-launch sequences
    autoLaunchSingleApply(page, context).catch(err => {
      console.error("[AutoLaunch] Error in single apply/turbo launcher:", err);
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

async function autoLaunchSingleApply(page, context) {
  const sleepHelper = ms => new Promise(r => setTimeout(r, ms));
  console.log("[AutoLaunch] Starting auto-launch single apply / turbo monitor loop...");
  
  let lastPageUrl = "";
  let autoLaunched = false;

  while (true) {
    await sleepHelper(2000);
    let activePages = [];
    try {
      activePages = context.pages().filter(p => !p.url().startsWith('chrome://') && !p.url().startsWith('about:'));
    } catch (err) {
      continue;
    }
    const targetPage = activePages.find(p => p.url().includes("ziprecruiter"));
    if (!targetPage) {
      continue;
    }
    
    const currentUrl = targetPage.url();
    if (currentUrl !== lastPageUrl) {
      console.log(`[AutoLaunch] Page navigation/reload detected (from "${lastPageUrl}" to "${currentUrl}"). Resetting auto-launch flag.`);
      lastPageUrl = currentUrl;
      autoLaunched = false;
    }

    try {
      const triggerSelector = '#ai-job-apply-extension-root >> .trigger-btn';
      const triggerBtn = targetPage.locator(triggerSelector);
      
      const isTriggerAttached = await triggerBtn.isVisible({ timeout: 1000 }).catch(() => false);
      if (!isTriggerAttached) {
        continue;
      }
      
      // Check if drawer is already open
      const drawerSelector = '#ai-job-apply-extension-root >> .drawer';
      const isOpen = await targetPage.locator(drawerSelector).evaluate(el => el.classList.contains('open')).catch(() => false);
      
      if (!isOpen) {
        console.log("[AutoLaunch] Drawer is closed. Clicking trigger button to open...");
        await triggerBtn.click();
        await sleepHelper(1000);
      }

      if (!autoLaunched) {
        const launchBtn = targetPage.locator('#ai-job-apply-extension-root >> #btn-start-turbo');
        const btnText = await launchBtn.innerText().catch(() => "");
        
        if (btnText.includes("Launch Turbo") || btnText.includes("Start Turbo")) {
          // Switch to Turbo tab first
          await targetPage.locator('#ai-job-apply-extension-root >> #tab-btn-turbo').click().catch(() => {});
          await sleepHelper(500);
          console.log(`[AutoLaunch] Launch button says "${btnText.trim()}". Clicking to start Turbo Mode...`);
          await launchBtn.click();
          autoLaunched = true;
        } else if (btnText.includes("Stop Turbo")) {
          // Already running
          autoLaunched = true;
        }
      }
    } catch (e) {
      // Ignore transient errors
    }
  }
}
