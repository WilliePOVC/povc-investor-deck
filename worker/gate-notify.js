/**
 * Cloudflare Worker: POVC Gate Notification
 * 
 * Endpoints:
 * POST /           — Gate page submits notification (writes to KV + forwards to VPS for email)
 * GET  /pending    — VPS poller fetches pending notifications (reads + deletes from KV)
 * GET  /viewers    — Full permanent viewer log (never deleted)
 * 
 * Requires KV namespace binding: GATE_KV
 * 
 * Storage strategy:
 * - notify_<ts>_<rand>  — pending notifications (24h TTL, deleted on /pending read)
 * - viewer_<ts>_<rand>  — permanent log (no TTL, never deleted)
 * 
 * Email notifications:
 * - Forwards to VPS gate-notify-server (port 3847) which sends via himalaya SMTP
 */

const VPS_URL = 'http://187.127.104.231:3847';

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

        const now = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const notification = { email, timestamp, ip, location, pt };

        // Store in KV (viewer log + pending)
        if (env.GATE_KV) {
          // Pending notification (24h TTL, consumed by /pending)
          await env.GATE_KV.put(`notify_${now}_${rand}`, JSON.stringify(notification), { expirationTtl: 86400 });
          // Permanent viewer log (no TTL, never deleted)
          await env.GATE_KV.put(`viewer_${now}_${rand}`, JSON.stringify(notification));
        }

        // Forward to VPS for email notification (fire-and-forget)
        const target = env.VPS_NOTIFY_URL || VPS_URL;
        fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, timestamp, ip, location }),
        }).catch(err => console.error('VPS email forward failed:', err));

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

    // GET /viewers — full permanent viewer log
    if (request.method === 'GET' && url.pathname === '/viewers') {
      try {
        if (!env.GATE_KV) {
          return new Response(JSON.stringify({ viewers: [], error: 'KV not bound' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const allViewers = [];
        let cursor = undefined;
        
        // Paginate through all viewer_ keys
        do {
          const list = await env.GATE_KV.list({ prefix: 'viewer_', cursor });
          for (const key of list.keys) {
            const val = await env.GATE_KV.get(key.name);
            if (val) {
              allViewers.push(JSON.parse(val));
            }
          }
          cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor);

        // Sort by timestamp (newest first)
        allViewers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ viewers: allViewers, total: allViewers.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ viewers: [], error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
