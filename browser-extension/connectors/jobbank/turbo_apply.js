const { chromium } = require('playwright');
const path = require('path');

(async () => {
  try {
    console.log("Connecting to real Google Chrome via CDP...");
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const pages = context.pages();
    
    // 1. Find or create localhost dashboard tab and ensure we are logged in as the correct user
    let localhostPage = pages.find(p => p.url().includes("localhost:5173") || p.url().includes("127.0.0.1:5173"));
    if (!localhostPage) {
      console.log("Localhost page not found. Creating new tab...");
      localhostPage = await context.newPage();
    }

    console.log("Navigating to http://localhost:5173/login...");
    await localhostPage.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await localhostPage.evaluate(() => localStorage.clear()).catch(() => {});
    await localhostPage.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await localhostPage.waitForTimeout(2000);

    try {
      const emailInput = localhostPage.locator('input[type="email"], input[name="email"]');
      const isLoginVisible = await emailInput.isVisible({ timeout: 4000 }).catch(() => false);
      if (isLoginVisible) {
        console.log("Logging in to localhost dashboard as kkumar.sandeep89@gmail.com...");
        await emailInput.fill('kkumar.sandeep89@gmail.com');
        await localhostPage.fill('input[type="password"], input[name="password"]', 'password');
        await localhostPage.click('button[type="submit"]');
        await localhostPage.waitForTimeout(4000);
      } else {
        console.log("Dashboard loaded after clearing storage.");
      }
    } catch (e) {
      console.warn("Failed/skipped auto-login checks on dashboard:", e.message);
    }

    // 2. Find and refresh Job Bank tab
    const targetPage = pages.find(p => p.url().includes("jobbank.gc.ca"));
    if (!targetPage) {
      console.error("No active Job Bank tab found!");
      return;
    }

    console.log("Clearing any previous active Turbo Mode states in the extension...");
    await targetPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_CLEAR_TURBO"));
    }).catch(() => {});
    await targetPage.waitForTimeout(1000);

    console.log(`Refreshing Job Bank tab: ${targetPage.url()}`);
    await targetPage.reload({ waitUntil: 'domcontentloaded' });
    await targetPage.waitForTimeout(4000);

    // 3. Open extension drawer
    console.log("Opening extension drawer...");
    const triggerBtn = targetPage.locator('#ai-job-apply-extension-root >> .trigger-btn');
    await triggerBtn.waitFor({ state: 'visible', timeout: 8000 });
    await triggerBtn.click();
    await targetPage.waitForTimeout(1500);

    // 4. Switch to Turbo Mode tab
    console.log("Switching to Turbo Mode tab...");
    const tabTurbo = targetPage.locator('#ai-job-apply-extension-root >> #tab-btn-turbo');
    await tabTurbo.waitFor({ state: 'visible', timeout: 5000 });
    await tabTurbo.click();
    await targetPage.waitForTimeout(1000);

    // 5. Click Launch Turbo Mode
    console.log("Locating 'Start Turbo Apply' button...");
    const startTurboBtn = targetPage.locator('#ai-job-apply-extension-root >> #btn-start-turbo');
    await startTurboBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    const isDisabled = await startTurboBtn.evaluate(el => el.disabled);
    const btnText = await startTurboBtn.innerText();
    console.log(`Button text: "${btnText.trim()}", disabled: ${isDisabled}`);

    if (isDisabled) {
      console.warn("Turbo button is disabled! You might need to log in to the dashboard manually.");
    }

    console.log("Clicking 'Start Turbo Apply' button...");
    await startTurboBtn.click();
    console.log("Clicked Start Turbo button successfully!");

    await targetPage.waitForTimeout(5000);
    console.log("Done!");
  } catch (err) {
    console.error("Error launching turbo mode:", err);
  }
})();
