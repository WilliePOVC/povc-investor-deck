#!/usr/bin/env node
/**
 * Gate Email Notification Daemon
 * 
 * Polls the Cloudflare Worker /pending endpoint every 30 seconds.
 * When new viewer notifications are found, sends email via himalaya.
 * 
 * This avoids needing to expose a port from Docker — the daemon pulls
 * notifications instead of the worker pushing them.
 * 
 * Usage: node gate-email-daemon.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const NOTIFY_URL = 'https://povc-gate-notify.willie-610.workers.dev';
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const NOTIFY_TO = ['willie@presson.vc', 'sean@presson.vc'];

async function sendEmail(visitorEmail, timestamp, ip, location) {
  const pt = new Date(timestamp || Date.now()).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const subject = `Press On Ventures — Fund I deck viewed by ${visitorEmail}`;

  for (const to of NOTIFY_TO) {
    const raw = [
      `From: tucker@presson.vc`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `Fund I Deck Viewed`,
      ``,
      `Email: ${visitorEmail}`,
      `Time: ${pt} (Pacific)`,
      `IP: ${ip || 'unknown'}`,
      `Location: ${location || 'unknown'}`,
      ``,
      `— Tucker (automated notification)`,
    ].join('\r\n');

    const tmpFile = join(tmpdir(), `gate-notify-${Date.now()}-${Math.random().toString(36).slice(2)}.eml`);
    try {
      writeFileSync(tmpFile, raw);
      const { stdout } = await execAsync(
        `himalaya message send --account tucker < "${tmpFile}"`,
        { timeout: 20000 }
      );
      console.log(`[OK] Notification sent to ${to} for viewer ${visitorEmail}`);
    } catch (err) {
      console.error(`[ERR] Failed to send to ${to}:`, err.message);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  }
}

async function pollAndNotify() {
  try {
    const res = await fetch(`${NOTIFY_URL}/pending`);
    if (!res.ok) {
      console.error(`[ERR] Worker returned ${res.status}`);
      return;
    }
    const data = await res.json();
    const notifications = data.notifications || [];

    if (notifications.length === 0) return;

    console.log(`[POLL] Found ${notifications.length} new viewer(s)`);
    for (const n of notifications) {
      console.log(`[GATE] Deck viewed by ${n.email} at ${n.pt}`);
      await sendEmail(n.email, n.timestamp, n.ip, n.location);
    }
  } catch (err) {
    console.error('[ERR] Poll failed:', err.message);
  }
}

// Initial poll immediately
console.log(`Gate email daemon started — polling every ${POLL_INTERVAL_MS / 1000}s`);
pollAndNotify();

// Then poll on interval
setInterval(pollAndNotify, POLL_INTERVAL_MS);
