import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/balaji.s/.gemini/antigravity/brain/38597010-9bf8-4236-8eca-7db761e05534/screenshots';

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile Upload Screen (375px width)
  console.log('Capturing Mobile Upload (375px)...');
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(500);
  // Click visible Report button in mobile bottom nav
  const reportBtn = mobilePage.locator('button:visible', { hasText: 'Report' });
  await reportBtn.first().click();
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'after_screen2_upload_mobile_375.png'),
    fullPage: true
  });
  await mobileContext.close();

  // 2. Officer Dashboard (Desktop 1440px)
  console.log('Capturing Officer Dashboard (1440px)...');
  const deskContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const deskPage = await deskContext.newPage();
  await deskPage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await deskPage.waitForTimeout(500);
  // Fast-track demo login as Officer
  const officerProfileBtn = deskPage.locator('button:has-text("Officer Profile")');
  if (await officerProfileBtn.count() > 0) {
    await officerProfileBtn.click();
    await deskPage.waitForTimeout(2000);
  } else {
    await deskPage.click('header nav button:has-text("Officer Dashboard")');
    await deskPage.waitForTimeout(2000);
  }
  await deskPage.screenshot({
    path: path.join(SCREENSHOT_DIR, 'after_screen5_officer_dashboard_desktop_1440.png'),
    fullPage: false
  });
  await deskContext.close();

  await browser.close();
  console.log('Remaining screenshots captured successfully!');
}

run().catch(console.error);
