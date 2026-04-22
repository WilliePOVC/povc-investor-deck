#!/usr/bin/env node
/**
 * Fetch co-investor logos from their websites.
 * Uses fetch to grab HTML, then extracts logo image URLs.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const OUT_DIR = join(import.meta.dirname, '..', 'assets', 'coinvestor-logos');
mkdirSync(OUT_DIR, { recursive: true });

const firms = [
  { name: 'upfront', url: 'https://upfront.com', logoSearch: ['og:image', 'logo'] },
  { name: 'palm-tree-crew', url: 'https://www.palmtreecrew.com', logoSearch: ['og:image', 'logo'] },
  { name: 'bam-ventures', url: 'https://www.bamventures.com', logoSearch: ['og:image', 'logo'] },
  { name: 'tenoneten', url: 'https://www.tenoneten.net', logoSearch: ['og:image', 'logo'] },
  { name: 'bold-capital', url: 'https://www.boldcapitalpartners.com', logoSearch: ['og:image', 'logo'] },
  { name: 'lerer-hippeau', url: 'https://www.lererhippeau.com', logoSearch: ['og:image', 'logo'] },
  { name: 'red-sea-ventures', url: 'https://www.redseaventures.com', logoSearch: ['og:image', 'logo'] },
  { name: 'jump-capital', url: 'https://jumpcap.com', logoSearch: ['og:image', 'logo'] },
  { name: 'bbg-ventures', url: 'https://www.bbgventures.com', logoSearch: ['og:image', 'logo'] },
  { name: 'courtside-vc', url: 'https://www.courtsidevc.com', logoSearch: ['og:image', 'logo'] },
  { name: 'next-ventures', url: 'https://www.nextventures.com', logoSearch: ['og:image', 'logo'] },
  { name: 'initialized', url: 'https://initialized.com', logoSearch: ['og:image', 'logo'] },
  { name: 'offline-ventures', url: 'https://offline.vc', logoSearch: ['og:image', 'logo'] },
  { name: 'point72-ventures', url: 'https://www.point72.com/ventures', logoSearch: ['og:image', 'logo'] },
];

async function fetchWithRedirects(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    redirect: 'follow',
  });
  return res;
}

async function extractLogoUrl(html, baseUrl) {
  // Try og:image first
  let match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (!match) match = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (match) return new URL(match[1], baseUrl).href;

  // Try twitter:image
  match = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!match) match = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (match) return new URL(match[1], baseUrl).href;

  // Try first img with "logo" in src, class, or alt
  const logoImgRegex = /<img[^>]+(?:src|class|alt)=["'][^"']*logo[^"']*["'][^>]*>/gi;
  const imgs = html.match(logoImgRegex);
  if (imgs) {
    for (const img of imgs) {
      const srcMatch = img.match(/src=["']([^"']+)["']/i);
      if (srcMatch) return new URL(srcMatch[1], baseUrl).href;
    }
  }

  // Try header img
  const headerMatch = html.match(/<header[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (headerMatch) return new URL(headerMatch[1], baseUrl).href;

  // Try first SVG with logo in it
  const svgMatch = html.match(/<a[^>]+(?:class|href)=["'][^"']*(?:logo|home)[^"']*["'][^>]*>[\s\S]*?<(?:img|svg)[^>]+(?:src=["']([^"']+)["'])?/i);
  if (svgMatch && svgMatch[1]) return new URL(svgMatch[1], baseUrl).href;

  return null;
}

async function downloadImage(url, name) {
  try {
    const res = await fetchWithRedirects(url);
    if (!res.ok) {
      console.log(`  ❌ Download failed: ${res.status}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    let ext = '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('svg')) ext = '.svg';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (url.match(/\.(png|jpg|jpeg|svg|webp)/i)) {
      ext = '.' + url.match(/\.(png|jpg|jpeg|svg|webp)/i)[1].toLowerCase();
    }
    
    const outPath = join(OUT_DIR, `${name}${ext}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buffer);
    console.log(`  ✅ Saved: ${name}${ext} (${(buffer.length/1024).toFixed(1)}KB)`);
    return `${name}${ext}`;
  } catch (e) {
    console.log(`  ❌ Download error: ${e.message}`);
    return null;
  }
}

async function processFirm(firm) {
  console.log(`\n${firm.name} (${firm.url})`);
  try {
    const res = await fetchWithRedirects(firm.url);
    if (!res.ok) {
      console.log(`  ❌ Fetch failed: ${res.status}`);
      return null;
    }
    const html = await res.text();
    const logoUrl = await extractLogoUrl(html, firm.url);
    if (logoUrl) {
      console.log(`  Found: ${logoUrl.substring(0, 100)}`);
      return await downloadImage(logoUrl, firm.name);
    } else {
      console.log(`  ⚠️ No logo found in HTML`);
      return null;
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    return null;
  }
}

// Process all firms
const results = {};
for (const firm of firms) {
  results[firm.name] = await processFirm(firm);
}

console.log('\n\n=== RESULTS ===');
for (const [name, file] of Object.entries(results)) {
  console.log(`${file ? '✅' : '❌'} ${name}: ${file || 'NEEDS MANUAL'}`);
}
