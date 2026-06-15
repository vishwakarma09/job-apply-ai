const { chromium } = require('playwright');
const path = require('path');

(async () => {
  try {
    console.log("Connecting to real Google Chrome via CDP...");
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const pages = context.pages();
    
    // 1. Find and refresh localhost dashboard to sync token
    const localhostPage = pages.find(p => p.url().includes("localhost:5173") || p.url().includes("127.0.0.1:5173"));
    if (localhostPage) {
      console.log("Refreshing localhost dashboard to synchronize extension token...");
      await localhostPage.reload({ waitUntil: 'domcontentloaded' });
      await localhostPage.waitForTimeout(3000);
    } else {
      console.warn("Localhost dashboard tab not found in browser context!");
    }

    // 2. Find and refresh Indeed tab
    const targetPage = pages.find(p => p.url().includes("indeed.com"));
    if (!targetPage) {
      console.error("No active Indeed tab found!");
      return;
    }

    console.log(`Refreshing Indeed tab: ${targetPage.url()}`);
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
