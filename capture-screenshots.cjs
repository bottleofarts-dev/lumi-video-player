const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  if (!fs.existsSync('public/screenshots')) fs.mkdirSync('public/screenshots', { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'public/screenshots/home.png' });
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if(b.innerHTML.includes('<line') || b.innerHTML.includes('<polygon')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'public/screenshots/library.png' });
  await page.evaluate(() => {
    const p = document.querySelectorAll('h3');
    if (p.length > 0 && p[0].closest('.cursor-pointer')) p[0].closest('.cursor-pointer').click();
    else { const c = document.querySelectorAll('.grid > div'); if(c.length) c[0].click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'public/screenshots/player.png' });
  await browser.close();
  require('child_process').execSync('cd public/screenshots && zip -r ../screenshots.zip .');
  console.log('Screenshots generated and zipped.');
})();