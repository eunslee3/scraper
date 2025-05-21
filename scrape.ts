import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

interface Product {
  title: string;
  tagline: string;
  mrr: string;
  link: string;
  mrrTier?: string;
}

export default async function scrapeIndieHackers() {
  const mrrTiers = [
    {
      label: 'low',
      url: 'https://www.indiehackers.com/products?minRevenue=0&maxRevenue=10000',
    },
    {
      label: 'mid',
      url: 'https://www.indiehackers.com/products?minRevenue=10000&maxRevenue=100000',
    },
    {
      label: 'high',
      url: 'https://www.indiehackers.com/products?minRevenue=100000',
    },
  ];

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 800 });

  // Login sequence
  await page.goto('https://www.indiehackers.com/sign-in', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForSelector('input[placeholder="Enter your email address"]', { visible: true });
  await page.waitForSelector('input[placeholder="Enter your password"]', { visible: true });

  await page.type('input[placeholder="Enter your email address"]', process.env.IH_EMAIL || '', { delay: 50 });
  await page.type('input[placeholder="Enter your password"]', process.env.IH_PASSWORD || '', { delay: 50 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => location.pathname !== '/sign-in', { timeout: 10000 })
  ]);

  console.log('✅ Logged in');

  const scrollToBottom = async (page: Page) => {
    let previousHeight = await page.evaluate('document.body.scrollHeight');
    let attempts = 0;

    while (attempts < 10) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await new Promise(r => setTimeout(r, 1500));
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) break;
      previousHeight = newHeight;
      attempts++;
    }
  };

  let allProducts: Product[] = [];

  for (const tier of mrrTiers) {
    console.log(`🔍 Scraping ${tier.label} MRR tier...`);

    await page.goto(tier.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForSelector('.product-card.ember-view', { visible: true, timeout: 15000 });
    await scrollToBottom(page);

    const products = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card.ember-view');
      return Array.from(cards).map(card => {
        const title = card.querySelector('.product-card__name')?.textContent?.trim() || '';
        const tagline = card.querySelector('.product-card__tagline')?.textContent?.trim() || '';
        const mrr = card.querySelector('.product-card__revenue-number')?.textContent?.trim() || '';
        const link = (card.querySelector('a.product-card__link') as HTMLAnchorElement)?.href || '';
        return { title, tagline, mrr, link } as Product;
      });
    });

    // Attach MRR tier to each product
    products.forEach(p => p.mrrTier = tier.label);
    allProducts.push(...products);

    console.log(`✅ Scraped ${products.length} products from ${tier.label} tier`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save to file
  fs.writeFileSync('ideas.json', JSON.stringify(allProducts, null, 2));
  console.log(`💾 Saved ${allProducts.length} total products to ideas.json`);

  await browser.close();
}

scrapeIndieHackers().catch(err => {
  console.error('❌ Scraper error:', err);
});
