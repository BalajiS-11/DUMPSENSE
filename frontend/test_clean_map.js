import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('header nav button:has-text("Live Map")');
  await page.waitForTimeout(4000);
  
  await page.screenshot({ 
    path: 'C:/Users/balaji.s/.gemini/antigravity/brain/38597010-9bf8-4236-8eca-7db761e05534/screenshots/test_clean_dark_map.png' 
  });
  
  await browser.close();
}

run().catch(console.error);
