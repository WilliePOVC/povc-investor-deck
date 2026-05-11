/**
 * Cloudflare Worker: POVC Gate Notification
 * 
 * Endpoints:
 * POST /           — Gate page submits notification (appends to single KV keys)
 * GET  /pending    — VPS poller fetches pending notifications (reads + clears)
 * GET  /viewers    — Full permanent viewer log (never deleted)
 * 
 * Requires KV namespace binding: GATE_KV
 * 
 * Storage strategy (v2 — single-key, no list() calls):
 * - "pending_queue"  — JSON array of pending notifications (cleared on /pending read)
 * - "viewers_log"    — JSON array of all viewers (permanent, append-only)
 * 
 * This avoids KV list() operations entirely, staying well within free tier limits.
 * Only uses get() and put() which have 100,000/day limit on free tier.
 */

const VPS_URL = 'http://187.127.104.231:3847';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
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

        const notification = { email, timestamp: timestamp || new Date().toISOString(), ip, location, pt };

        if (env.GATE_KV) {
          // Append to pending queue
          const pendingRaw = await env.GATE_KV.get('pending_queue');
          const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
          pending.push(notification);
          await env.GATE_KV.put('pending_queue', JSON.stringify(pending));

          // Append to permanent viewer log
          const viewersRaw = await env.GATE_KV.get('viewers_log');
          const viewers = viewersRaw ? JSON.parse(viewersRaw) : [];
          viewers.push(notification);
          await env.GATE_KV.put('viewers_log', JSON.stringify(viewers));
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

    // GET /pending — fetch and clear pending notifications
    if (request.method === 'GET' && url.pathname === '/pending') {
      try {
        if (!env.GATE_KV) {
          return new Response(JSON.stringify({ notifications: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const pendingRaw = await env.GATE_KV.get('pending_queue');
        const notifications = pendingRaw ? JSON.parse(pendingRaw) : [];

        // Clear the queue
        if (notifications.length > 0) {
          await env.GATE_KV.put('pending_queue', '[]');
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
          return new Response(JSON.stringify({ viewers: [], total: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const viewersRaw = await env.GATE_KV.get('viewers_log');
        const viewers = viewersRaw ? JSON.parse(viewersRaw) : [];

        // Sort newest first
        viewers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ viewers, total: viewers.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ viewers: [], error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /migrate — one-time migration from old individual keys to new single-key format
    if (request.method === 'GET' && url.pathname === '/migrate') {
      try {
        if (!env.GATE_KV) {
          return new Response(JSON.stringify({ ok: false, error: 'KV not bound' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const allViewers = [];
        const allPending = [];
        let cursor = undefined;

        // Migrate viewer_ keys
        do {
          const list = await env.GATE_KV.list({ prefix: 'viewer_', cursor });
          for (const key of list.keys) {
            const val = await env.GATE_KV.get(key.name);
            if (val) allViewers.push(JSON.parse(val));
          }
          cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor);

        // Migrate notify_ keys
        cursor = undefined;
        do {
          const list = await env.GATE_KV.list({ prefix: 'notify_', cursor });
          for (const key of list.keys) {
            const val = await env.GATE_KV.get(key.name);
            if (val) allPending.push(JSON.parse(val));
          }
          cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor);

        // Write to new single keys
        if (allViewers.length > 0) {
          allViewers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          await env.GATE_KV.put('viewers_log', JSON.stringify(allViewers));
        }
        if (allPending.length > 0) {
          await env.GATE_KV.put('pending_queue', JSON.stringify(allPending));
        }

        return new Response(JSON.stringify({
          ok: true,
          migrated: { viewers: allViewers.length, pending: allPending.length }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
