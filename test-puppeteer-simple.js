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

    const pages = [
      { name: 'Home', url: '/' },
      { name: 'Explorer', url: '/explorer' },
      { name: 'Curves', url: '/curves' },
      { name: 'FOMC', url: '/fomc' },
      { name: 'Convexity', url: '/convexity' }
    ];

    for (const pageInfo of pages) {
      try {
        console.log(`\nTesting ${pageInfo.name} page...`);
        await page.goto(`http://localhost:3000${pageInfo.url}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        // Wait a bit for React to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await page.screenshot({ path: `screenshot-${pageInfo.name.toLowerCase()}.png` });
        
        // Get page title
        const title = await page.title();
        console.log(`✅ ${pageInfo.name} - Title: ${title}`);
        
        // Check for main content
        const hasContent = await page.$('main') !== null;
        console.log(`   Main content: ${hasContent ? 'Found' : 'Not found'}`);
        
        // Check navigation
        const navLinks = await page.$$eval('nav a', links => links.length);
        console.log(`   Navigation links: ${navLinks}`);
        
      } catch (error) {
        console.error(`❌ Error loading ${pageInfo.name}: ${error.message}`);
      }
    }

    // Test interactive elements on home page
    console.log('\n📊 Testing interactive elements...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    
    // Check for chart
    const hasChart = await page.$('canvas') !== null;
    console.log(`   Chart canvas: ${hasChart ? 'Found' : 'Not found'}`);
    
    // Check for market data inputs
    const inputs = await page.$$eval('input[type="number"]', inputs => inputs.length);
    console.log(`   Market data inputs: ${inputs}`);

    console.log('\n✅ Testing complete!');

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await browser.close();
  }
})();