#!/usr/bin/env node
/**
 * Gate Notification Server
 * 
 * Lightweight HTTP endpoint that receives gate unlock notifications
 * and sends emails via himalaya (tucker@presson.vc SMTP).
 * 
 * Runs on port 3847 on the VPS.
 * 
 * Usage: node gate-notify-server.mjs
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);
const PORT = 3847;
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

    // Write to temp file to avoid shell escaping issues
    const tmpFile = join(tmpdir(), `gate-notify-${Date.now()}-${Math.random().toString(36).slice(2)}.eml`);
    try {
      writeFileSync(tmpFile, raw);
      const { stdout, stderr } = await execAsync(
        `himalaya message send --account tucker < "${tmpFile}"`,
        { timeout: 20000 }
      );
      console.log(`[OK] Notification sent to ${to}`);
      if (stdout.trim()) console.log(`  stdout: ${stdout.trim()}`);
    } catch (err) {
      console.error(`[ERR] Failed to send to ${to}:`, err.message);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  }
}

const server = createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const { email, timestamp, ip, location } = data;
      
      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing email' }));
        return;
      }

      console.log(`[GATE] Deck viewed by ${email} at ${timestamp}`);
      
      // Send async — don't block the response
      sendEmail(email, timestamp, ip, location);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[ERR] Parse error:', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gate notify server listening on 0.0.0.0:${PORT}`);
});
