import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(1000);
  await page.click('header nav button:has-text("Live Map")');
  await page.waitForTimeout(4000);
  await browser.close();
}

run().catch(console.error);
