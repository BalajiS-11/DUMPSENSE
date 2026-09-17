import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/balaji.s/.gemini/antigravity/brain/38597010-9bf8-4236-8eca-7db761e05534/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureAfter() {
  console.log('Launching browser for After screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. Screen 1: Landing Page (Desktop 1440px)
  console.log('1. Capturing Overhauled Landing Page (Desktop 1440px)...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, 'after_screen1_landing_desktop_1440.png'),
    fullPage: false 
  });

  // 2. Screen 3: Live Map with real Dark tiles, SVG markers, sparkline analytics
  console.log('2. Navigating to Overhauled Live Map...');
  // Click navbar Live Map button
  await page.click('header nav button:has-text("Live Map")');
  await page.waitForTimeout(3500); // Allow Mapbox GL / Carto Dark Matter tiles to load
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, 'after_screen3_live_map_desktop_1440.png')
  });

  // 3. Screen 2: Mobile Upload at 375px
  console.log('3. Navigating to Citizen Upload Screen at 375px mobile...');
  await page.setViewportSize({ width: 375, height: 812 });
  // Click mobile bottom nav button "Report"
  await page.click('button:has-text("Report")');
  await page.waitForTimeout(1500);
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, 'after_screen2_upload_mobile_375.png'),
    fullPage: true 
  });

  // 4. Screen 5: Officer Dashboard at 1440px
  console.log('4. Navigating to Officer Dashboard at 1440px...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  
  // Fast-track login via Officer Profile
  const officerProfileBtn = page.locator('button:has-text("Officer Profile")');
  if (await officerProfileBtn.count() > 0) {
    await officerProfileBtn.click();
    await page.waitForTimeout(2000);
  } else {
    await page.click('header nav button:has-text("Officer Dashboard")');
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, 'after_screen5_officer_dashboard_desktop_1440.png'),
    fullPage: false 
  });

  await browser.close();
  console.log('All After screenshots captured successfully in:', SCREENSHOT_DIR);
}

captureAfter().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
