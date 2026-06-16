# VanHack Platform Connector Simulation & Automation

This directory contains the VanHack integration connector for the AI Job Apply Assistant extension. It also contains monitoring and automation scripts to test and run the integration.

## Files
*   `index.js`: The connector implementation, containing DOM selectors, metadata scraping, card selectors, and step-by-step form-filling auto-fill logic.
*   `monitor.js`: Playwright-based test script that opens a headed browser session with the extension loaded, navigates to VanHack, and monitors the application forms, capturing snapshots and JSON state maps.
*   `turbo_apply.js`: Script to programmatically trigger the **Turbo Apply** flow automatically once the page is loaded and logged in.

## Running the Simulation

### Prerequisites
1. Ensure the backend database and API server are running (`docker-compose up` or via local virtualenv).
2. Make sure you have Playwright installed:
   ```bash
   npm install playwright
   ```

### 1. Running the Monitor / Simulation
The monitor script launches a Google Chrome browser with the extension loaded, navigates to VanHack, and prompts you to log in. Once logged in and on the job search page, press Enter in your terminal to start the automated loop:
```bash
node browser-extension/connectors/vanhack/monitor.js
```

### 2. Auto-Starting Turbo Apply
To trigger the automated application flow without manually opening the drawer and clicking the button, run the following command in a separate terminal tab while `monitor.js` is running:
```bash
node browser-extension/connectors/vanhack/turbo_apply.js
```
