export const runtime = 'edge';

// Helper to get KV binding
function getKV(env: any) {
  return env?.ATS_KV;
}

// POST - Clear cache
export async function POST(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    const { userId, clearAll } = body;
    
    if (!kv) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No server cache to clear (using localStorage)' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (clearAll) {
      // Clear all resume caches
      const keys = await kv.list({ prefix: 'resume_cache:' });
      for await (const key of keys.keys) {
        await kv.delete(key.name);
      }
      
      // Clear optimization history
      const historyKeys = await kv.list({ prefix: 'history:' });
      for await (const key of historyKeys.keys) {
        await kv.delete(key.name);
      }
    }
    
    if (userId) {
      // Clear specific user's cache
      await kv.delete(`resume_cache:${userId}`);
      await kv.delete(`history:${userId}`);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Cache cleared successfully' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
