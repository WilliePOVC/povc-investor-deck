#!/usr/bin/env node
/**
 * Use agent-browser to screenshot logos from each VC firm's website.
 * Takes a full page screenshot then crops the header area where logos live.
 */
import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

const OUT_DIR = '/data/.openclaw/workspace/povc-investor-deck/assets/coinvestor-logos';

// Firms we still need logos for
const firms = [
  { name: 'upfront', url: 'https://upfront.com' },
  { name: 'palm-tree-crew', url: 'https://www.palmtreecrew.com' },
  { name: 'bam-ventures', url: 'https://www.bamventures.com' },
  { name: 'tenoneten', url: 'https://www.tenoneten.net' },
  { name: 'bold-capital', url: 'https://www.boldcapitalpartners.com' },
  { name: 'courtside-vc', url: 'https://www.courtsidevc.com' },
  { name: 'red-sea-ventures', url: 'https://www.redseaventures.com' },
  { name: 'point72-ventures', url: 'https://www.point72ventures.com' },
  { name: 'initialized', url: 'https://initialized.com' },
  { name: 'offline-ventures', url: 'https://offline.vc' },
];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return e.stdout?.trim() || '';
  }
}

for (const firm of firms) {
  console.log(`\n--- ${firm.name} ---`);
  run(`agent-browser open "${firm.url}"`);
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 3000));
  
  const ssPath = `${OUT_DIR}/${firm.name}-screenshot.png`;
  run(`agent-browser screenshot ${ssPath}`);
  
  const title = run(`agent-browser get title --json`);
  console.log(`  Title: ${title}`);
  console.log(`  Screenshot saved`);
}

console.log('\nDone! Review screenshots to extract logos.');
