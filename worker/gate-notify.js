/**
 * Cloudflare Worker: POVC Gate Notification
 * 
 * Receives POST from the gate page when someone unlocks the deck.
 * Sends notification email to Willie + Sean via tucker@presson.vc SMTP.
 * 
 * Environment Variables (set in Cloudflare dashboard):
 *   SMTP_HOST     - e.g. smtp.gmail.com
 *   SMTP_PORT     - e.g. 587
 *   SMTP_USER     - tucker@presson.vc
 *   SMTP_PASS     - app password for tucker@presson.vc
 *   GATE_PASSWORD  - povc2026 (for server-side verification if needed)
 * 
 * Deploy: wrangler deploy
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://fundone.presson.vc',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { email, timestamp } = await request.json();
      if (!email) {
        return new Response('Missing email', { status: 400 });
      }

      // Get visitor IP and geo from Cloudflare headers
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const country = request.headers.get('cf-ipcountry') || 'unknown';
      const city = request.cf?.city || 'unknown';
      const region = request.cf?.region || '';

      // Format timestamp in Pacific Time
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

      const subject = `Press On Ventures — Fund I deck viewed by ${email}`;
      const body = [
        `Fund I Deck Viewed`,
        ``,
        `Email: ${email}`,
        `Time: ${pt} (Pacific)`,
        `IP: ${ip}`,
        `Location: ${city}${region ? ', ' + region : ''}, ${country}`,
        ``,
        `— Tucker (automated notification)`,
      ].join('\n');

      // Send via MailChannels (free for Cloudflare Workers)
      const emailPayload = {
        personalizations: [
          {
            to: [
              { email: 'willie@presson.vc', name: 'Willie Litvack' },
              { email: 'sean@presson.vc', name: 'Sean Tolkin' },
            ],
          },
        ],
        from: { email: 'tucker@presson.vc', name: 'Tucker - Press On Ventures' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      };

      const emailResp = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResp.ok) {
        const errText = await emailResp.text();
        console.error('MailChannels error:', emailResp.status, errText);
        // Don't fail the response — log and move on
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://fundone.presson.vc',
        },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://fundone.presson.vc',
        },
      });
    }
  },
};
