export const runtime = 'edge';

// Helper to get KV binding
function getKV(env: any) {
  return env?.ATS_KV;
}

// GET - Get audit logs
export async function GET(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    
    if (!kv) {
      return new Response(JSON.stringify({ logs: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const logs = await kv.get('audit_logs', 'json') as any[] || [];
    
    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Return last 100 logs
    return new Response(JSON.stringify({ logs: logs.slice(0, 100) }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, logs: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Add audit log
export async function POST(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    const { action, details, userId, username } = body;
    
    if (!kv) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const logs = await kv.get('audit_logs', 'json') as any[] || [];
    
    logs.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      action,
      details: details || '',
      userId: userId || '',
      username: username || '',
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 logs
    const trimmedLogs = logs.slice(-1000);
    
    await kv.put('audit_logs', JSON.stringify(trimmedLogs));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
