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
const FUND_TARGET = 20; // $20M target

async function queryAllPages(dbId) {
  const results = [];
  let cursor = null;
  while (true) {
    const body = { page_size: 100 };
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
    const num = prop.type === 'formula' ? (prop.formula?.number || 0) : (prop.number || 0);
    if (num > 0) total += num;
  }
  return total;
}

async function main() {
  console.log('Fetching LP data from Notion...');
  const lpRecords = await queryAllPages(LP_DB_ID);
  console.log(`  Found ${lpRecords.length} LP records`);

  const raised = sumField(lpRecords, 'Fund One Capital Closed');
  const raisedM = raised / 1000000;
  const raisedStr = raisedM === Math.floor(raisedM) ? `${raisedM}` : `${raisedM.toFixed(2)}`;
  const raisedPct = Math.round((raisedM / FUND_TARGET) * 100);
  
  console.log(`  Fund One Capital Closed: $${raisedStr}M`);
  console.log(`  Raise progress: ${raisedPct}%`);

  // Read HTML
  const htmlPath = join(DECK_DIR, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  // Replace using simple string operations (avoid regex $ issues)
  // 1. Raised chip
  html = html.replace(
    /<div class="fp-chip"><span>Raised<\/span><strong>[^<]+<\/strong><\/div>/,
    `<div class="fp-chip"><span>Raised</span><strong>$${raisedStr}M</strong></div>`
  );
  console.log('  ✅ Raised chip');

  // 2. Fund raise bar value
  html = html.replace(
    /<span class="fp-raise-val"><strong>[^<]+<\/strong>/,
    `<span class="fp-raise-val"><strong>$${raisedStr}M</strong>`
  );
  console.log('  ✅ Fund raise bar');

  // 3. Donut "of $X raised"
  html = html.replace(
    /of \$[\d.]+M raised/,
    `of $${raisedStr}M raised`
  );
  console.log('  ✅ Donut label');

  // 4. Fund raise bar width
  html = html.replace(
    /class="fp-raise-fill" style="width:\d+%"/,
    `class="fp-raise-fill" style="width:${raisedPct}%"`
  );
  console.log('  ✅ Raise bar width');

  writeFileSync(htmlPath, html);
  console.log(`\n✅ Deck updated: Raised = $${raisedStr}M (${raisedPct}% of $${FUND_TARGET}M)`);
}

main().catch(console.error);
