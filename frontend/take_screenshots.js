import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/balaji.s/.gemini/antigravity/brain/38597010-9bf8-4236-8eca-7db761e05534/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureAll() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Screen 1: Landing / Login (Desktop 1440px)
  console.log('1. Capturing Landing / Login screen...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen1_landing_desktop_1440.png'), fullPage: true });

  // 2. Screen 3: Live Map (Main Screen)
  console.log('2. Navigating to Live Map...');
  await page.click('button:has-text("Explore Live Civic Map")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen3_live_map_desktop_1440.png') });

  // 3. Screen 6: Predictive Heatmap Overlay ("Predict Tonight" toggled ON)
  console.log('3. Toggling Predict Tonight for Heatmap Overlay...');
  await page.click('button:has-text("Predict Tonight")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen6_predictive_heatmap_desktop_1440.png') });

  // 4. Screen 2: Upload Report (Desktop 1440px)
  console.log('4. Navigating to Upload Report (Desktop)...');
  await page.click('header nav button:has-text("Report Incident")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen2_upload_desktop_1440.png'), fullPage: true });

  // 5. Screen 2 at Mobile 375px Width (Strictly required in prompt)
  console.log('5. Capturing Upload Report at Mobile 375px...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen2_upload_mobile_375.png'), fullPage: true });

  // 6. Tablet 768px Width Test
  console.log('6. Capturing Upload Report at Tablet 768px...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen2_upload_tablet_768.png'), fullPage: true });

  // Reset back to Desktop 1440px
  await page.setViewportSize({ width: 1440, height: 900 });

  // 7. Screen 5: Officer Dashboard
  console.log('7. Navigating to Officer Dashboard...');
  // Quick switch to Officer or click Sign in / Dashboard
  await page.click('button:has-text("Sign In")').catch(() => {});
  await page.waitForTimeout(500);
  const officerDemoBtn = page.locator('button:has-text("Officer Profile")');
  if (await officerDemoBtn.count() > 0) {
    await officerDemoBtn.click();
    await page.waitForTimeout(1200);
  } else {
    await page.click('header nav button:has-text("Officer Dashboard")');
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen5_officer_dashboard_desktop_1440.png'), fullPage: true });

  // 8. Screen 4: Report Detail Screen
  console.log('8. Opening Report Detail...');
  // Click first Inspect button or table row thumbnail
  const inspectBtn = page.locator('button[title="Inspect Detailed Dossier"]').first();
  if (await inspectBtn.count() > 0) {
    await inspectBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'screen4_report_detail_desktop_1440.png'), fullPage: true });
  }

  await browser.close();
  console.log('All screenshots captured successfully in:', SCREENSHOT_DIR);
}

captureAll().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
