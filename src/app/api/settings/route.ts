export const runtime = 'edge';

// Helper to get KV binding
function getKV(env: any) {
  return env?.ATS_KV;
}

// GET - Get settings
export async function GET(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    
    if (!kv) {
      return new Response(JSON.stringify({ settings: {} }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const settings = await kv.get('system_settings', 'json') || {};
    
    return new Response(JSON.stringify({ settings }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, settings: {} }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Update settings
export async function POST(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    
    if (!kv) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const existingSettings = await kv.get('system_settings', 'json') || {};
    const newSettings = { ...existingSettings, ...body, updatedAt: new Date().toISOString() };
    
    await kv.put('system_settings', JSON.stringify(newSettings));
    
    return new Response(JSON.stringify({ success: true, settings: newSettings }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
