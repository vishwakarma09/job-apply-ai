# Randstad Canada Connector Simulation & Automation

This directory contains the Randstad Canada integration connector for the AI Job Apply Assistant extension. It also contains monitoring and automation scripts to test and run the integration.

## Files
*   `index.js`: The connector implementation, containing DOM selectors, JSON-LD metadata scraping, card selectors, and step-by-step form-filling auto-fill logic.
*   `monitor.js`: Playwright-based test script that opens a headed browser session with the extension loaded, navigates to Randstad Canada, and monitors the application forms, capturing snapshots and JSON state maps.

## Running the Simulation

### Prerequisites
1. Ensure the backend database and API server are running (`docker-compose up` or via local virtualenv).
2. Make sure you have Playwright installed:
   ```bash
   npm install playwright
   ```

### 1. Running the Monitor / Simulation
The monitor script launches a Google Chrome browser with the extension loaded, navigates to Randstad Canada, and prompts you to log in. Once logged in and on the job search page, press Enter in your terminal to start the automated loop:
```bash
node browser-extension/connectors/randstad/monitor.js
```
Interactive commands inside the terminal:
*   `c` / Enter: Capture the current DOM state, field mappings, and save a screenshot.
*   `q` / `exit`: Quit the monitor session and close Chrome.
