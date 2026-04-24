#!/usr/bin/env node
/**
 * Pull live fund data from Notion and update the investor deck.
 * Run: node scripts/update-fund-data.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_DIR = join(__dirname, '..');

// Load env
const envPath = '/data/.openclaw/.env';
const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) env[key.trim()] = val.join('=').trim();
});

const NOTION_API_KEY = env.NOTION_API_KEY;
const LP_DB_ID = '196e9175-4432-80c5-babc-f095f1b259ba';

async function queryAllPages(dbId, filter = {}) {
  const results = [];
  let cursor = null;
  
  while (true) {
    const body = { page_size: 100, ...filter };
    if (cursor) body.start_cursor = cursor;
    
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await resp.json();
    results.push(...(data.results || []));
    
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  
  return results;
}

function sumField(results, fieldName) {
  let total = 0;
  for (const r of results) {
    const prop = r.properties?.[fieldName];
    if (!prop) continue;
    
    let num = 0;
    if (prop.type === 'formula') {
      num = prop.formula?.number || 0;
    } else if (prop.type === 'number') {
      num = prop.number || 0;
    }
    if (num > 0) total += num;
  }
  return total;
}

function formatM(amount) {
  // Format as $X.XXM
  const m = amount / 1000000;
  if (m === Math.floor(m)) return `$${m}M`;
  return `$${m.toFixed(2)}M`;
}

async function main() {
  console.log('Fetching LP data from Notion...');
  const lpRecords = await queryAllPages(LP_DB_ID);
  console.log(`  Found ${lpRecords.length} LP records`);
  
  // Sum Fund One Capital Closed
  const fundOneRaised = sumField(lpRecords, 'Fund One Capital Closed');
  const fundOneRaisedM = formatM(fundOneRaised);
  console.log(`  Fund One Capital Closed: ${fundOneRaisedM}`);
  
  // Update the deck HTML
  const htmlPath = join(DECK_DIR, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  
  // Update the "Raised" chip
  const raisedChipRegex = /(<div class="fp-chip"><span>Raised<\/span><strong>)\$[\d.]+M(<\/strong><\/div>)/;
  if (raisedChipRegex.test(html)) {
    html = html.replace(raisedChipRegex, `$1${fundOneRaisedM}$2`);
    console.log(`  ✅ Updated Raised chip to ${fundOneRaisedM}`);
  }
  
  // Update the fund raise bar label
  const raiseValRegex = /(<strong>)\$[\d.]+M(<\/strong> <span class="fp-raise-of">)/;
  if (raiseValRegex.test(html)) {
    html = html.replace(raiseValRegex, `$1${fundOneRaisedM}$2`);
    console.log(`  ✅ Updated fund raise bar to ${fundOneRaisedM}`);
  }
  
  // Update the donut "of $XM raised" text
  const donutFundRegex = /(of )\$[\d.]+M( raised)/;
  if (donutFundRegex.test(html)) {
    html = html.replace(donutFundRegex, `$1${fundOneRaisedM}$2`);
    console.log(`  ✅ Updated donut label to ${fundOneRaisedM}`);
  }
  
  // Update the fund raise progress bar width (raised/target * 100)
  const target = 20; // $20M target - static for now
  const raisedPct = Math.round((fundOneRaised / 1000000 / target) * 100);
  const raiseWidthRegex = /(class="fp-raise-fill" style="width:)\d+%/;
  if (raiseWidthRegex.test(html)) {
    html = html.replace(raiseWidthRegex, `$1${raisedPct}%`);
    console.log(`  ✅ Updated fund raise bar width to ${raisedPct}%`);
  }
  
  writeFileSync(htmlPath, html);
  console.log('\n✅ Deck updated with live Notion data!');
}

main().catch(console.error);
