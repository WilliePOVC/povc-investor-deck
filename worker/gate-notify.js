/**
 * Cloudflare Worker: POVC Gate Notification Proxy
 * 
 * Receives POST from the gate page, enriches with IP/geo from Cloudflare,
 * then forwards to the VPS notification server which sends via SMTP.
 */

const VPS_URL = 'http://187.127.104.231:3847';

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
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
        return new Response(JSON.stringify({ ok: false, error: 'Missing email' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Enrich with Cloudflare geo data
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const country = request.headers.get('cf-ipcountry') || 'unknown';
      const city = request.cf?.city || 'unknown';
      const region = request.cf?.region || '';
      const location = `${city}${region ? ', ' + region : ''}, ${country}`;

      // Forward to VPS (fire-and-forget, don't block gate access)
      const target = env.VPS_NOTIFY_URL || VPS_URL;
      fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, timestamp, ip, location }),
      }).catch(err => console.error('VPS forward failed:', err));

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
