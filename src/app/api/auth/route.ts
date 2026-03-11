export const runtime = 'edge';

// Helper to get KV binding
function getKV(env: any) {
  return env?.ATS_KV;
}

// Hash password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ats_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate session token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST - Login
export async function POST(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    const { username, password, action } = body;
    
    // Handle logout
    if (action === 'logout') {
      return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle login
    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get users from KV
    let users: any[] = [];
    if (kv) {
      const usersData = await kv.get('users', 'json');
      users = usersData as any[] || [];
    }
    
    // Default admin credentials (for first-time setup)
    const defaultAdminPassword = await hashPassword('Santafee@@@@@1972');
    const defaultAdmin = {
      id: 'admin-default',
      username: 'admin',
      password: defaultAdminPassword,
      role: 'admin',
      status: 'active',
      fullName: 'Administrator',
      email: 'admin@ats.local',
      credits: 100
    };
    
    // Add default admin if no users exist
    if (users.length === 0) {
      users.push(defaultAdmin);
      if (kv) {
        await kv.put('users', JSON.stringify(users));
      }
    }
    
    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check status
    if (user.status === 'suspended') {
      return new Response(JSON.stringify({ error: 'Account is suspended' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate session token
    const token = generateToken();
    
    // Store session in KV
    if (kv) {
      const sessions = await kv.get('sessions', 'json') as any[] || [];
      sessions.push({
        token,
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      });
      // Keep only last 1000 sessions
      const recentSessions = sessions.slice(-1000);
      await kv.put('sessions', JSON.stringify(recentSessions));
    }
    
    // Return user without password
    const { password: _, ...safeUser } = user;
    
    return new Response(JSON.stringify({ 
      user: safeUser, 
      token,
      success: true 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': `ats_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET - Verify session
export async function GET(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    
    // Get token from cookie or header
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/ats_session=([^;]+)/);
    const token = tokenMatch?.[1] || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (kv) {
      const sessions = await kv.get('sessions', 'json') as any[] || [];
      const session = sessions.find(s => s.token === token && s.expiresAt > Date.now());
      
      if (!session) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const users = await kv.get('users', 'json') as any[] || [];
      const user = users.find(u => u.id === session.userId);
      
      if (!user || user.status === 'suspended') {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const { password: _, ...safeUser } = user;
      return new Response(JSON.stringify({ valid: true, user: safeUser }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
