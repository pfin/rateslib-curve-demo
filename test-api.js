const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing API endpoints...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    
    // Intercept network requests
    await page.setRequestInterception(true);
    const apiCalls = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url: request.url()
        });
      }
      request.continue();
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API Response: ${response.status()} ${response.url()}`);
      }
    });

    // Test Home Page
    console.log('Loading Home Page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if chart is rendered
    const hasChart = await page.$('canvas') !== null;
    console.log(`Chart canvas: ${hasChart ? 'Found ✅' : 'Not Found ❌'}`);
    
    // Test Curve Builder
    console.log('\nLoading Curve Builder...');
    await page.goto('http://localhost:3000/curves', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if curve data is displayed
    const hasCharts = await page.$$eval('canvas', elements => elements.length);
    console.log(`Charts found: ${hasCharts}`)
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results.png' });
    
    console.log('\nAPI Calls Made:');
    apiCalls.forEach(call => {
      console.log(`  ${call.method} ${call.url}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();