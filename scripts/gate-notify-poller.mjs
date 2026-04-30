#!/usr/bin/env node
/**
 * Gate Notification Poller
 * 
 * Polls the Cloudflare Worker every 30 seconds for new gate notifications.
 * Sends emails via himalaya and posts to Discord #deck-access-log.
 * 
 * Usage: node gate-notify-poller.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);
const WORKER_URL = 'https://povc-gate-notify.willie-610.workers.dev/pending';
const NOTIFY_TO = ['willie@presson.vc', 'sean@presson.vc'];
const POLL_INTERVAL = 30000; // 30 seconds

async function sendEmail(notification) {
  const { email, pt, ip, location } = notification;
  const subject = `Press On Ventures — Fund I deck viewed by ${email}`;
  
  for (const to of NOTIFY_TO) {
    const raw = [
      `From: tucker@presson.vc`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `Fund I Deck Viewed`,
      ``,
      `Email: ${email}`,
      `Time: ${pt || 'unknown'} (Pacific)`,
      `IP: ${ip || 'unknown'}`,
      `Location: ${location || 'unknown'}`,
      ``,
      `— Tucker (automated notification)`,
    ].join('\r\n');

    const tmpFile = join(tmpdir(), `gate-notify-${Date.now()}.eml`);
    try {
      writeFileSync(tmpFile, raw);
      await execAsync(`himalaya message send --account tucker < "${tmpFile}"`, { timeout: 20000 });
      console.log(`[OK] Email sent to ${to} re: ${email}`);
    } catch (err) {
      console.error(`[ERR] Email to ${to} failed:`, err.message);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  }
}

async function poll() {
  try {
    const resp = await fetch(WORKER_URL);
    const data = await resp.json();
    
    if (data.notifications && data.notifications.length > 0) {
      console.log(`[POLL] ${data.notifications.length} new notification(s)`);
      for (const n of data.notifications) {
        console.log(`[GATE] ${n.email} — ${n.pt} — ${n.ip} — ${n.location}`);
        await sendEmail(n);
      }
    }
  } catch (err) {
    // Silent on network errors — just retry next cycle
    if (!err.message.includes('fetch')) {
      console.error('[ERR] Poll:', err.message);
    }
  }
}

console.log('Gate notification poller started (every 30s)');
poll(); // Check immediately
setInterval(poll, POLL_INTERVAL);
