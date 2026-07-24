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
const FUND_TARGET = 15; // $15M target

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
  // The progress BAR width can never exceed 100% (avoid visual overflow), but the
  // label shows the TRUE percentage even when over-target.
  const barPct = Math.min(raisedPct, 100);

  console.log(`  Fund One Capital Closed: $${raisedStr}M`);
  console.log(`  Raise progress: ${raisedPct}% (bar capped at ${barPct}%)`);

  // Read HTML
  const htmlPath = join(DECK_DIR, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  // The deck uses the "cd-" Capital-Deployment slide markup. (Older "fp-" markup
  // was removed in a redesign — do NOT re-add it.) Each replace() counts its
  // matches so a markup drift surfaces as a warning instead of a silent no-op.
  const apply = (label, re, repl) => {
    if (!re.test(html)) {
      console.warn(`  ⚠ ${label}: NO MATCH (deck markup may have changed)`);
      return;
    }
    const before = html;
    html = html.replace(re, repl);
    console.log(`  ✅ ${label}${html === before ? ' (already current)' : ''}`);
  };

  // 1. Raised chip: <div class="cd-chip"><span>Raised</span><strong>$X</strong></div>
  apply('Raised chip',
    /(<div class="cd-chip"><span>Raised<\/span><strong>)\$[^<]+(<\/strong>)/,
    `$1$$${raisedStr}M$2`
  );

  // 2. Fund raise bar value: <strong>$X</strong> inside .cd-raise-val
  apply('Raise bar value',
    /(<span class="cd-raise-val">\s*<strong>)\$[^<]+(<\/strong>)/,
    `$1$$${raisedStr}M$2`
  );

  // 3. Raise-of label: "raised of $15M target · NN%"
  apply('Raise-of label',
    /raised of \$[\d.]+M target · [\d.]+%/,
    `raised of $${FUND_TARGET}M target · ${raisedPct}%`
  );

  // 4. Donut center label: "of $X raised"
  apply('Donut label',
    /of \$[\d.]+M raised/,
    `of $${raisedStr}M raised`
  );

  // 5. Raise bar fill width (capped at 100%)
  apply('Raise bar width',
    /(class="cd-raise-fill" style="width:)[\d.]+%/,
    `$1${barPct}%`
  );

  writeFileSync(htmlPath, html);
  console.log(`\n✅ Deck updated: Raised = $${raisedStr}M (${raisedPct}% of $${FUND_TARGET}M)`);
}

main().catch(console.error);
