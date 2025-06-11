const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Test Home Page
    console.log('Testing Home Page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-home.png' });
    const homeTitle = await page.title();
    console.log('Home page title:', homeTitle);

    // Test Explorer Page
    console.log('\nTesting Explorer Page...');
    await page.goto('http://localhost:3000/explorer', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-explorer.png' });
    
    // Check if examples are loaded
    const exampleCount = await page.$$eval('button[class*="text-left p-3"]', buttons => buttons.length);
    console.log(`Found ${exampleCount} examples on Explorer page`);

    // Test Curve Builder Page
    console.log('\nTesting Curve Builder Page...');
    await page.goto('http://localhost:3000/curves', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-curves.png' });
    
    // Check if market data inputs exist
    const marketDataInputs = await page.$$eval('input[type="number"]', inputs => inputs.length);
    console.log(`Found ${marketDataInputs} market data inputs on Curves page`);

    // Test FOMC Page
    console.log('\nTesting FOMC Page...');
    await page.goto('http://localhost:3000/fomc', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-fomc.png' });
    
    // Check for FOMC meeting buttons
    const fomcMeetings = await page.$$eval('button[class*="w-full text-left p-3"]', buttons => buttons.length);
    console.log(`Found ${fomcMeetings} FOMC meetings on FOMC page`);

    // Test Convexity Page
    console.log('\nTesting Convexity Page...');
    await page.goto('http://localhost:3000/convexity', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-convexity.png' });
    
    // Check for convexity examples
    const convexityExamples = await page.$$eval('button[class*="w-full text-left p-3"]', buttons => buttons.length);
    console.log(`Found ${convexityExamples} convexity examples`);

    // Test navigation
    console.log('\nTesting Navigation...');
    const navLinks = await page.$$eval('nav a', links => links.map(link => ({
      text: link.textContent,
      href: link.href
    })));
    console.log('Navigation links:', navLinks);

    console.log('\n✅ All pages loaded successfully!');

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
  }
})();