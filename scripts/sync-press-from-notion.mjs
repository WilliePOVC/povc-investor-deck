#!/usr/bin/env bun
/**
 * sync-press-from-notion.mjs
 * 
 * Pulls Portfolio Press entries from Notion (Publish=Yes),
 * generates the marquee HTML for slide 9 of the investor deck,
 * and updates index.html in-place.
 * 
 * Usage: bun run scripts/sync-press-from-notion.mjs [--dry-run]
 * 
 * Requires: NOTION_API_KEY env var
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_ROOT = join(__dirname, '..');
const INDEX_PATH = join(DECK_ROOT, 'index.html');
const DRY_RUN = process.argv.includes('--dry-run');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) { console.error('Missing NOTION_API_KEY'); process.exit(1); }

const headers = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const DB_ID = '36ce9175-4432-81b1-88fd-e9d46f533b94';

// Outlets that get the serif font class
const SERIF_OUTLETS = new Set(['WSJ', 'LABJ']);

// Notable outlet full names for the bottom bar
const NOTABLE_OUTLETS = [
  'Forbes', 'WSJ', 'TechCrunch', 'New York Post', 'Fast Company',
  'WWD', 'CNET', 'Entrepreneur', 'Healthcare Brew', 'LABJ',
  'Yahoo', 'Business Wire', 'PR Newswire',
];

// Display name → full name for the outlets bar
const DISPLAY_TO_FULL = {
  'NY Post': 'New York Post',
  'Fast Co.': 'Fast Company',
  'Silicon Rep.': 'Silicon Republic',
  'Authority Mag.': 'Authority Magazine',
  'Healthcare Brew': 'Healthcare Brew',
  'Business Wire': 'Business Wire',
  'PR Newswire': 'PR Newswire',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Row CSS classes (preserve existing design)
const ROW_CLASSES = ['press-scroll-l', 'press-scroll-r', 'press-scroll-l-slow'];
const ROW_COMMENTS = [
  'Row 1: scrolls left',
  'Row 2: scrolls right',
  'Row 3: scrolls left slow',
];

// ─── Fetch Notion entries ───────────────────────────────────
async function fetchPressEntries() {
  const entries = [];
  let cursor = undefined;
  
  do {
    const body = {
      filter: { property: 'Publish', select: { equals: 'Yes' } },
      sorts: [{ property: 'Date Published', direction: 'descending' }],
    };
    if (cursor) body.start_cursor = cursor;
    
    const resp = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const data = await resp.json();
    
    for (const page of data.results) {
      const p = page.properties;
      entries.push({
        headline: p.Headline?.title?.[0]?.plain_text || '',
        url: p.URL?.url || '',
        pubDisplayName: p['Publication Display Name']?.rich_text?.[0]?.plain_text || '',
        companyDisplayName: p['Company Display Name']?.rich_text?.[0]?.plain_text || '',
        dateStr: p['Date Published']?.date?.start || '',
      });
    }
    
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  
  return entries;
}

// ─── Format date for display ────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'Ongoing';
  const d = new Date(dateStr + 'T00:00:00');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  // If day is 1 and no specific day context, still show month + year
  return `${month} ${year}`;
}

// ─── HTML escape ────────────────────────────────────────────
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/'/g, '&rsquo;')
    .replace(/'/g, '&lsquo;')
    .replace(/"/g, '&ldquo;')
    .replace(/"/g, '&rdquo;')
    .replace(/—/g, '&mdash;')
    .replace(/–/g, '&ndash;')
    .replace(/€/g, '&euro;')
    .replace(/£/g, '&pound;');
}

// ─── Generate a single press card ───────────────────────────
function renderCard(entry) {
  const serifClass = SERIF_OUTLETS.has(entry.pubDisplayName) ? ' press-serif' : '';
  const dateDisplay = formatDate(entry.dateStr);
  
  return `            <a href="${esc(entry.url)}" target="_blank" rel="noopener" class="press-card">
              <div class="press-card-outlet"><span class="press-outlet-name${serifClass}">${esc(entry.pubDisplayName)}</span><span class="press-outlet-date">${esc(dateDisplay)}</span></div>
              <div class="press-card-headline">${esc(entry.headline)}</div>
              <div class="press-card-company">${esc(entry.companyDisplayName)}</div>
            </a>`;
}

// ─── Distribute entries across 3 rows (round-robin) ────────
function distributeToRows(entries) {
  const rows = [[], [], []];
  entries.forEach((entry, i) => {
    rows[i % 3].push(entry);
  });
  return rows;
}

// ─── Generate the outlets bar ───────────────────────────────
function renderOutletsBar(entries) {
  // Collect unique publication display names, map to full names, pick notable ones
  const seen = new Set();
  const outlets = [];
  
  for (const e of entries) {
    const display = e.pubDisplayName;
    if (!display || seen.has(display)) continue;
    seen.add(display);
    const fullName = DISPLAY_TO_FULL[display] || display;
    outlets.push(fullName);
  }
  
  // Filter to notable outlets that actually appear, preserving NOTABLE_OUTLETS order
  const bar = NOTABLE_OUTLETS.filter(n => outlets.some(o => o === n));
  // Add any remaining that aren't in the notable list
  for (const o of outlets) {
    if (!bar.includes(o) && !['YouTube', 'ShoutoutLA', 'VentureBurn', 'Rhythm360', 'Bird', 'Travel Weekly'].includes(o)) {
      bar.push(o);
    }
  }
  
  return bar.map((name, i) => {
    const dot = i < bar.length - 1 ? '<span class="press-bar-dot">&middot;</span>' : '';
    return `        <span>${esc(name)}</span>${dot}`;
  }).join('\n');
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log('Fetching Notion entries (Publish=Yes)...');
  const entries = await fetchPressEntries();
  console.log(`Found ${entries.length} entries to publish.`);
  
  if (entries.length === 0) {
    console.error('No entries found! Aborting to avoid blank slide.');
    process.exit(1);
  }
  
  // Sort by date descending (entries with no date go last)
  entries.sort((a, b) => {
    if (!a.dateStr && !b.dateStr) return 0;
    if (!a.dateStr) return 1;
    if (!b.dateStr) return -1;
    return b.dateStr.localeCompare(a.dateStr);
  });
  
  // Distribute across 3 rows
  const rows = distributeToRows(entries);
  
  // Generate row HTML
  const rowsHtml = rows.map((rowEntries, i) => {
    const cards = rowEntries.map(renderCard).join('\n');
    // Duplicate cards for seamless infinite scroll loop
    const duplicateCards = rowEntries.map(renderCard).join('\n');
    
    return `          <!-- ${ROW_COMMENTS[i]} -->
          <div class="press-row ${ROW_CLASSES[i]}">
${cards}
            <!-- duplicate set for seamless loop -->
${duplicateCards}
          </div>`;
  }).join('\n');
  
  const pressRowsBlock = `        <div class="press-rows">
${rowsHtml}
        </div>`;
  
  // Generate outlets bar
  const outletsBarContent = renderOutletsBar(entries);
  
  // Read current index.html
  let html = readFileSync(INDEX_PATH, 'utf-8');
  
  // Replace press-rows block
  const rowsRegex = /(<div class="press-rows">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>\s*\n\s*<div class="press-outlets-bar)/;
  const rowsMatch = html.match(rowsRegex);
  if (!rowsMatch) {
    console.error('Could not find press-rows block in index.html!');
    process.exit(1);
  }
  
  // More precise replacement: find the press-rows div and its closing, then the outlets bar
  const pressRowsStart = html.indexOf('<div class="press-rows">');
  if (pressRowsStart === -1) { console.error('Cannot find press-rows start'); process.exit(1); }
  
  // Find the matching closing </div> for press-rows
  // The structure is: press-rows > (3x press-row divs) > /press-rows
  // Then: /press-marquee inner > /press-marquee
  // Then: press-outlets-bar
  const outletsBarStart = html.indexOf('<div class="press-outlets-bar', pressRowsStart);
  if (outletsBarStart === -1) { console.error('Cannot find press-outlets-bar'); process.exit(1); }
  
  // Find end of press-rows content (everything between press-rows and the closing divs before outlets bar)
  // Count divs to find the right closing tag
  let depth = 0;
  let pressRowsEnd = -1;
  for (let i = pressRowsStart; i < outletsBarStart; i++) {
    if (html.substring(i, i + 4) === '<div') depth++;
    if (html.substring(i, i + 6) === '</div>') {
      depth--;
      if (depth === 0) {
        pressRowsEnd = i + 6;
        break;
      }
    }
  }
  
  if (pressRowsEnd === -1) {
    console.error('Could not find press-rows closing tag');
    process.exit(1);
  }
  
  // Replace press-rows block
  html = html.substring(0, pressRowsStart) + pressRowsBlock + html.substring(pressRowsEnd);
  
  // Now replace outlets bar content (find it again since positions shifted)
  const outletsStart2 = html.indexOf('<div class="press-outlets-bar');
  const outletsInnerStart = html.indexOf('>', outletsStart2) + 1;
  const outletsEnd = html.indexOf('</div>', outletsInnerStart);
  
  html = html.substring(0, outletsInnerStart) + '\n' + outletsBarContent + '\n      ' + html.substring(outletsEnd);
  
  if (DRY_RUN) {
    console.log('\n--- DRY RUN: Generated press-rows HTML ---');
    console.log(pressRowsBlock.substring(0, 500) + '...');
    console.log(`\n--- Outlets bar ---`);
    console.log(outletsBarContent);
    console.log('\nDry run complete. No files modified.');
  } else {
    writeFileSync(INDEX_PATH, html);
    console.log(`\n✅ Updated ${INDEX_PATH}`);
    console.log(`   ${entries.length} press entries across 3 rows`);
    console.log(`   Each row duplicated for infinite scroll`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
