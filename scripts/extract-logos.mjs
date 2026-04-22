#!/usr/bin/env node
/**
 * Use agent-browser to extract logo URLs from VC firm websites.
 * Navigates to each site, runs JS to find logo elements, extracts the image source.
 */
import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

const OUT_DIR = join(import.meta.dirname, '..', 'assets', 'coinvestor-logos');

const firms = [
  { name: 'upfront', url: 'https://upfront.com' },
  { name: 'palm-tree-crew', url: 'https://www.palmtreecrew.com' },
  { name: 'bam-ventures', url: 'https://www.bamventures.com' },
  { name: 'tenoneten', url: 'https://www.tenoneten.net' },
  { name: 'bold-capital', url: 'https://www.boldcapitalpartners.com' },
  { name: 'courtside-vc', url: 'https://www.courtsidevc.com' },
  { name: 'red-sea-ventures', url: 'https://www.redseaventures.com' },
  { name: 'point72-ventures', url: 'https://www.point72ventures.com' },
];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim();
  } catch(e) {
    return e.stdout?.trim() || '';
  }
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, outPath).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(outPath, buf);
        resolve(buf.length);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// JS to extract logo from a page
const extractJS = `
(() => {
  // Strategy 1: Look for img/svg in header/nav with logo in class/alt/src
  const candidates = [];
  
  // Check header/nav images
  const headerImgs = document.querySelectorAll('header img, nav img, [class*="logo"] img, img[class*="logo"], img[alt*="logo" i], a[href="/"] img, a[aria-label*="home" i] img');
  for (const img of headerImgs) {
    if (img.src) candidates.push({ src: img.src, type: 'header-img', w: img.naturalWidth });
  }
  
  // Check for SVGs used as logos
  const svgLogos = document.querySelectorAll('header svg, nav svg, [class*="logo"] svg');
  // Can't easily extract SVG src, skip
  
  // Check background images on logo containers
  const logoContainers = document.querySelectorAll('[class*="logo"], [class*="brand"], header a:first-child');
  for (const el of logoContainers) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const urlMatch = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
      if (urlMatch) candidates.push({ src: urlMatch[1], type: 'bg-img' });
    }
  }
  
  // Strategy 2: Check og:image as fallback
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) candidates.push({ src: ogImg.content, type: 'og' });
  
  return JSON.stringify(candidates);
})()
`;

async function processUrl(firm) {
  console.log(`\\n=== ${firm.name} (${firm.url}) ===`);
  
  // Navigate
  run(`agent-browser open "${firm.url}"`);
  await new Promise(r => setTimeout(r, 3000));
  
  // Extract logo candidates via JS evaluation
  const result = run(`agent-browser get text @e1 --json`);
  
  // Take a screenshot for manual reference
  const ssPath = `/tmp/ss-${firm.name}.png`;
  run(`agent-browser screenshot ${ssPath}`);
  console.log(`  Screenshot: ${ssPath}`);
  
  // Try to get page HTML and extract logo manually  
  const titleResult = run(`agent-browser get title --json`);
  console.log(`  Title: ${titleResult}`);
}

// Process each firm
for (const firm of firms) {
  await processUrl(firm);
}
