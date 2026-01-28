// ============================================
// CLOUDFLARE WORKER - Interview Schedule
// With Cloudflare KV persistent storage
// ============================================

const ADMIN_PASSWORD = "cedars123!";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Serve main page
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return serveAsset(env, 'index.html');
    }
    
    // Serve documents
    if (url.pathname.startsWith('/documents/')) {
      const filename = url.pathname.substring(11); // Remove "/documents/"
      return serveAsset(env, `documents/${filename}`);
    }
    
    // API: Get single override
    if (url.pathname === '/api/override' && request.method === 'GET') {
      return getOverride(url, env);
    }
    
    // API: Save override
    if (url.pathname === '/api/override' && request.method === 'POST') {
      return saveOverride(request, env);
    }
    
    // API: Get all overrides for a candidate
    if (url.pathname.startsWith('/api/overrides/candidate/')) {
      const candidateName = decodeURIComponent(url.pathname.substring(26));
      return getCandidateOverrides(candidateName, env);
    }
    
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

// ============================================
// SERVE STATIC ASSETS
// ============================================

async function serveAsset(env, path) {
  try {
    // Try to get from KV first (if cached)
    const cached = await env.ASSETS.get(path);
    if (cached) {
      const contentType = getContentType(path);
      return new Response(cached, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          ...corsHeaders
        }
      });
    }
    
    return new Response('File not found', { status: 404, headers: corsHeaders });
  } catch (error) {
    return new Response('Error loading asset: ' + error.message, {
      status: 500,
      headers: corsHeaders
    });
  }
}

function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html;charset=UTF-8';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

// ============================================
// KV STORAGE OPERATIONS
// ============================================

async function getOverride(url, env) {
  const key = url.searchParams.get('key');
  
  if (!key) {
    return new Response('Missing key parameter', {
      status: 400,
      headers: corsHeaders
    });
  }
  
  try {
    const value = await env.OVERRIDES.get(key);
    
    return new Response(value || 'null', {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function saveOverride(request, env) {
  try {
    const { key, value } = await request.json();
    
    if (!key || !value) {
      return new Response('Missing key or value', {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Store in KV
    await env.OVERRIDES.put(key, JSON.stringify(value));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function getCandidateOverrides(candidateName, env) {
  try {
    const prefix = `override_${candidateName}_`;
    const list = await env.OVERRIDES.list({ prefix });
    
    const overrides = {};
    
    for (const key of list.keys) {
      const sessionIndex = key.name.split('_').pop();
      const value = await env.OVERRIDES.get(key.name);
      if (value) {
        overrides[sessionIndex] = JSON.parse(value);
      }
    }
    
    return new Response(JSON.stringify(overrides), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
