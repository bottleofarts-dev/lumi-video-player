const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  if (!fs.existsSync('public/screenshots')) {
    fs.mkdirSync('public/screenshots', { recursive: true });
  }

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Mobile viewport
  await page.setViewport({ width: 390, height: 844 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'public/screenshots/home.png' });

  // Click on Library tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('nav button');
    if (tabs.length >= 1) tabs[1].click(); // Assuming 2nd is Library based on icon order
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshots/library.png' });

  // Click on Settings tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('nav button');
    if (tabs.length >= 2) tabs[2].click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshots/settings.png' });

  // Go back to Home and open player
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('nav button');
    if (tabs.length >= 0) tabs[0].click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.grid > div');
    if (cards.length > 0) cards[0].click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'public/screenshots/player.png' });

  await browser.close();

  // Zip them
  const cp = require('child_process');
  cp.execSync('cd public/screenshots && zip -r ../screenshots.zip .');
  console.log('Screenshots generated and zipped successfully.');
})();
