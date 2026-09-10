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
const PIPELINE_DB_ID = '165b6a7c-ea91-4201-8428-4778232954b4'; // Venture Pipeline
const FUND_TARGET = 15; // $15M target

// GP policy allocations (not derivable from Notion). Dry powder is the
// residual: raised - invested - reserves - fees. Update these two when the
// reserve policy or fee budget changes.
const RESERVES = 2_151_532; // earmarked for follow-ons into existing portcos
const FEES = 4_440_000;     // management fee + fund expenses

// Companies whose capital came via an SPV, NOT Fund One.
// SPVs are separate vehicles (see slide 11), so their capital must never be
// counted in Fund One deployed capital. The Venture Pipeline DB does not
// distinguish fund-vs-SPV investments, so the exclusion has to live here.
// Telly is SPV-only ($565K) — including it inflated deployed to $6.49M/13 cos
// when the true Fund One figure is $5.93M/12 cos.
const SPV_ONLY_COMPANIES = ['Telly'];

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

  // 3. Raise-of label: "raised of $15M target · NN% [· oversubscribed]"
  //    Keeps the oversubscribed callout whenever we are above target.
  apply('Raise-of label',
    /raised of \$[\d.]+M target · [\d.]+%(?: · oversubscribed)?/,
    `raised of $${FUND_TARGET}M target · ${raisedPct}%${raisedPct > 100 ? ' · oversubscribed' : ''}`
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

  // ---------------------------------------------------------------------
  // 6. Capital-deployment buckets.
  //
  // The four buckets MUST sum to the raised total, otherwise the donut and
  // every percentage on the slide are computed against a stale denominator.
  // That drift is exactly what happened when raised went $14.82M -> $15.32M
  // without re-allocating: $500K of LP capital was missing from the chart.
  //
  // Invested is derived live from the Venture Pipeline "Total Invested"
  // formula (Initial + Follow On 1 + Follow On 2). Reserves and fees are
  // GP policy numbers held here; dry powder is the residual so the slide
  // always ties to the penny.
  // ---------------------------------------------------------------------
  console.log('\nReconciling capital deployment buckets...');
  const pipelineAll = await queryAllPages(PIPELINE_DB_ID);
  const titleOf = r => (r.properties?.['Company Name']?.title || [])
    .map(x => x.plain_text).join('').trim();

  // Fund One portfolio = Funded, has capital, and not an SPV-only vehicle.
  const fundOne = pipelineAll.filter(r => {
    const st = r.properties?.['Status']?.select?.name;
    const ti = r.properties?.['Total Invested']?.formula?.number || 0;
    if (st !== 'Funded' || ti <= 0) return false;
    if (SPV_ONLY_COMPANIES.some(n => n.toLowerCase() === titleOf(r).toLowerCase())) {
      console.log(`  ↳ excluding ${titleOf(r)} ($${ti.toLocaleString()}) — SPV, not Fund One`);
      return false;
    }
    return true;
  });

  const invested = sumField(fundOne, 'Total Invested');
  const portcoCount = fundOne.length;

  const reserves = RESERVES;
  const fees = FEES;
  const dryPowder = raised - invested - reserves - fees;

  const m = n => `$${(n / 1e6).toFixed(2)}M`;
  const pct = n => Math.round((n / raised) * 100);

  console.log(`  Invested (live from pipeline): ${m(invested)} across ${portcoCount} companies`);
  console.log(`  Reserves:   ${m(reserves)}`);
  console.log(`  Fees:       ${m(fees)}`);
  console.log(`  Dry powder: ${m(dryPowder)} (residual)`);

  const bucketSum = invested + reserves + fees + dryPowder;
  if (Math.abs(bucketSum - raised) > 1) {
    console.error(`  ❌ buckets ${m(bucketSum)} != raised ${m(raised)} — ABORTING`);
    process.exit(1);
  }
  if (dryPowder < 0) {
    console.error(`  ❌ dry powder is negative (${m(dryPowder)}) — over-allocated. ABORTING`);
    process.exit(1);
  }
  console.log(`  ✅ buckets tie to ${m(raised)}`);

  apply('Deployment subtitle',
    /<strong>\$[\d.]+M<\/strong> deployed across <strong>\d+ portfolio companies<\/strong> · <strong>\$[\d.]+M<\/strong> reserved for follow-ons(?: · <strong>\$[\d.]+M<\/strong> dry powder)?/,
    `<strong>${m(invested)}</strong> deployed across <strong>${portcoCount} portfolio companies</strong> · <strong>${m(reserves)}</strong> reserved for follow-ons · <strong>${m(dryPowder)}</strong> dry powder`
  );
  apply('Donut hero', /(<div class="cd-donut-hero">)\$[\d.]+M/, (_all, a) => `${a}${m(invested)}`);
  apply('Put to work', /[\d.]+% put to work/, `${pct(invested)}% put to work`);

  // Donut arcs — dasharray/dashoffset must close the circle exactly.
  const C = 2 * Math.PI * 110;
  let offset = 0;
  for (const [cls, val] of [['invested', invested], ['reserves', reserves], ['dry', dryPowder], ['fees', fees]]) {
    const dash = (val / raised) * C;
    const off = offset === 0 ? '0' : (-offset).toFixed(2);
    apply(`Donut arc: ${cls}`,
      new RegExp(`(class="cd-donut-${cls}" stroke-dasharray=")[\\d.]+ [\\d.]+(" stroke-dashoffset=")-?[\\d.]+`),
      (_all, a, b) => `${a}${dash.toFixed(2)} ${(C - dash).toFixed(2)}${b}${off}`
    );
    offset += dash;
  }

  // Breakdown rows: value + pct label + meter bar width, keyed by row class.
  // NOTE: use a replacer FUNCTION, not a `$1` template string. The bucket
  // values contain "$2.15M"/"$2.80M", and in a replacement string `$2`/`$1`
  // are interpreted as capture-group backreferences — which silently ate the
  // dollar amounts and corrupted the markup. Functions receive the groups as
  // plain args and never re-interpret `$`.
  for (const [cls, val] of [['cd-row-primary', invested], ['cd-row-muted-1', reserves], ['cd-row-ghost', dryPowder], ['cd-row-muted-2', fees]]) {
    apply(`Row ${cls}`,
      new RegExp(`(<div class="cd-row ${cls}[^"]*"[^>]*>[\\s\\S]*?<div class="cd-row-val">)\\$[\\d.]+M(</div>\\s*<div class="cd-row-pct">)\\d+%([\\s\\S]*?style="width:)\\d+%`),
      (_all, a, b, c) => `${a}${m(val)}${b}${pct(val)}%${c}${pct(val)}%`
    );
  }

  // Group totals
  const portcoGroup = invested + reserves + dryPowder;
  apply('Portfolio group total',
    /(<span class="cd-group-label">Portfolio Companies<\/span>\s*<span class="cd-group-total">)\$[\d.]+M · \d+%/,
    (_all, a) => `${a}${m(portcoGroup)} · ${pct(portcoGroup)}%`
  );
  apply('Fund ops group total',
    /(<span class="cd-group-label">Fund Operations<\/span>\s*<span class="cd-group-total">)\$[\d.]+M · \d+%/,
    (_all, a) => `${a}${m(fees)} · ${pct(fees)}%`
  );

  // Footer stats derived from invested
  apply('Reserve ratio',
    /(<div class="cd-stat-val">)[\d.]+(<span>:1<\/span>)/,
    (_all, a, b) => `${a}${(reserves / invested).toFixed(2)}${b}`
  );
  apply('Avg check size',
    /(<div class="cd-stat-val">)\$\d+(<span>K<\/span>)/,
    (_all, a, b) => `${a}$${Math.round(invested / portcoCount / 1000)}${b}`
  );
  apply('Avg check sub',
    /Across \d+ portfolio companies/,
    `Across ${portcoCount} portfolio companies`
  );

  writeFileSync(htmlPath, html);
  console.log(`\n✅ Deck updated: Raised = $${raisedStr}M (${raisedPct}% of $${FUND_TARGET}M)`);
  console.log(`✅ Buckets: invested ${m(invested)} · reserves ${m(reserves)} · dry ${m(dryPowder)} · fees ${m(fees)} = ${m(raised)}`);
}

main().catch(console.error);
