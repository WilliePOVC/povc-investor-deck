/**
 * Cloudflare Worker: POVC Gate Notification
 * 
 * Two endpoints:
 * POST /           — Gate page submits notification (writes to KV)
 * GET  /pending    — VPS poller fetches pending notifications (reads + deletes from KV)
 * 
 * Requires KV namespace binding: GATE_KV
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST / — receive gate notification
    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
      try {
        const { email, timestamp } = await request.json();
        if (!email) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing email' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const country = request.headers.get('cf-ipcountry') || 'unknown';
        const city = request.cf?.city || 'unknown';
        const region = request.cf?.region || '';
        const location = `${city}${region ? ', ' + region : ''}, ${country}`;

        const pt = new Date(timestamp || Date.now()).toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        const notification = { email, timestamp, ip, location, pt };
        const key = `notify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        if (env.GATE_KV) {
          await env.GATE_KV.put(key, JSON.stringify(notification), { expirationTtl: 86400 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /pending — VPS poller fetches and clears pending notifications
    if (request.method === 'GET' && url.pathname === '/pending') {
      try {
        if (!env.GATE_KV) {
          return new Response(JSON.stringify({ notifications: [], error: 'KV not bound' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const list = await env.GATE_KV.list({ prefix: 'notify_' });
        const notifications = [];

        for (const key of list.keys) {
          const val = await env.GATE_KV.get(key.name);
          if (val) {
            notifications.push(JSON.parse(val));
            await env.GATE_KV.delete(key.name);
          }
        }

        return new Response(JSON.stringify({ notifications }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ notifications: [], error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
