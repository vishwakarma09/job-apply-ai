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

console.log("=== LinkedIn Job Application Monitor (Real Chrome Edition) ===");
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
      newPage.on('console', msg => {
        console.log(`[Browser Console Subtab] ${msg.type().toUpperCase()}: ${msg.text()}`);
      });
      newPage.on('pageerror', err => {
        console.log(`[Browser PageError Subtab] ${err.message}`);
      });
    });

    console.log("Navigating to LinkedIn search page...");
    await page.goto('https://www.linkedin.com/jobs/search/?keywords=Software%20Developer&location=Toronto%2C%20Ontario%2C%20Canada', { waitUntil: 'domcontentloaded' }).catch(e => {
      console.log("Navigation warning:", e.message);
    });

    // Auto-launch Turbo Mode sequence
    autoLaunchTurboMode(page, context).catch(err => {
      console.error("[AutoLaunch] Error in background launcher:", err);
    });

    console.log("\n==================================================================");
    console.log("INSTRUCTIONS FOR USER:");
    console.log("1. Please log in to your LinkedIn account in the newly opened Chrome window if you aren't already.");
    console.log("2. The script will automatically search for jobs and click the first card.");
    console.log("3. The script will monitor the page and automatically log each step.");
    console.log("4. Press Enter or type 'c' in this terminal to trigger a manual capture.");
    console.log("==================================================================\n");

    let stepCounter = 0;
    let lastStepSignature = '';

    // Function to scan active forms
    async function scanPageForForms() {
      const activePages = context.pages().filter(p => !p.url().startsWith('chrome://') && !p.url().startsWith('about:'));
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
              
              const container = el.closest('.fb-form-element, [class*="input"], [class*="form"]');
              if (container) {
                const header = container.querySelector('span, label, p, div');
                if (header && header !== el) return header.innerText.trim();
              }
              
              return '';
            };

            const heading = document.querySelector('h1, h2, h3, [class*="header"], [class*="title"]')?.innerText?.trim() || '';

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
  console.log("[AutoLaunch] Waiting for LinkedIn search page to settle...");
  await page.waitForTimeout(6000);

  try {
    const cardSelector = '.jobs-search-results-list__list-item, [data-occludable-job-id]';
    await page.waitForSelector(cardSelector, { timeout: 15000 });
    
    console.log("[AutoLaunch] Finding first job card...");
    const cards = page.locator(cardSelector);
    const count = await cards.count();
    console.log(`[AutoLaunch] Found ${count} job cards.`);
    
    if (count > 0) {
      console.log("[AutoLaunch] Clicking the first job card to trigger details and widget load...");
      const firstCard = cards.first();
      await firstCard.click();
      
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
      
      console.log("[AutoLaunch] Clicking 'Start Turbo Apply' button!");
      await startTurboBtn.click();
      console.log("[AutoLaunch] Turbo mode successfully launched! Monitoring the progress...");
    } else {
      console.log("[AutoLaunch] No job cards found to click.");
    }
  } catch (e) {
    console.log("[AutoLaunch] Error during auto launch sequence:", e.message);
  }
}
