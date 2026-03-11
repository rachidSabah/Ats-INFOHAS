export const runtime = 'edge';

// Helper to get KV binding
function getKV(env: any) {
  return env?.ATS_KV;
}

// Generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Simple password hashing (for edge runtime)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ats_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}

// GET - List all users
export async function GET(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    
    let users: any[] = [];
    
    if (kv) {
      // Use Cloudflare KV
      const usersData = await kv.get('users', 'json');
      users = usersData as any[] || [];
    } else {
      // Fallback: Return empty array (no server-side storage in edge without KV)
      // This will trigger client-side migration
      return new Response(JSON.stringify({ 
        users: [], 
        needsMigration: true,
        message: 'KV not available' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Remove passwords from response
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      status: u.status,
      fullName: u.fullName,
      email: u.email,
      credits: u.credits,
      createdAt: u.createdAt
    }));
    
    return new Response(JSON.stringify({ users: safeUsers }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Create new user
export async function POST(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    const { username, password, role, fullName, email, credits } = body;
    
    if (!username || !password || !email) {
      return new Response(JSON.stringify({ error: 'Username, password, and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get existing users
    let users: any[] = [];
    if (kv) {
      const usersData = await kv.get('users', 'json');
      users = usersData as any[] || [];
    }
    
    // Check if username exists
    if (users.find(u => u.username === username)) {
      return new Response(JSON.stringify({ error: 'Username already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if email exists
    if (users.find(u => u.email === email)) {
      return new Response(JSON.stringify({ error: 'Email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create new user
    const hashedPassword = await hashPassword(password);
    const newUser = {
      id: generateId(),
      username,
      password: hashedPassword,
      role: role || 'user',
      status: 'active',
      fullName: fullName || '',
      email,
      credits: credits ?? 2,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    if (kv) {
      await kv.put('users', JSON.stringify(users));
    }
    
    // Return user without password
    const { password: _, ...safeUser } = newUser;
    
    return new Response(JSON.stringify({ user: safeUser, success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT - Update user
export async function PUT(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const body = await request.json();
    const { id, username, password, role, status, fullName, email, credits } = body;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get existing users
    let users: any[] = [];
    if (kv) {
      const usersData = await kv.get('users', 'json');
      users = usersData as any[] || [];
    }
    
    // Find user
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if new username conflicts
    if (username && username !== users[userIndex].username) {
      if (users.find(u => u.username === username)) {
        return new Response(JSON.stringify({ error: 'Username already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Check if new email conflicts
    if (email && email !== users[userIndex].email) {
      if (users.find(u => u.email === email)) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Update user
    if (username) users[userIndex].username = username;
    if (password) {
      users[userIndex].password = await hashPassword(password);
    }
    if (role) users[userIndex].role = role;
    if (status) users[userIndex].status = status;
    if (fullName !== undefined) users[userIndex].fullName = fullName;
    if (email) users[userIndex].email = email;
    if (credits !== undefined) users[userIndex].credits = credits;
    users[userIndex].updatedAt = new Date().toISOString();
    
    if (kv) {
      await kv.put('users', JSON.stringify(users));
    }
    
    // Return user without password
    const { password: _, ...safeUser } = users[userIndex];
    
    return new Response(JSON.stringify({ user: safeUser, success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Delete user
export async function DELETE(request: Request) {
  try {
    const env = (request as any).env;
    const kv = getKV(env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get existing users
    let users: any[] = [];
    if (kv) {
      const usersData = await kv.get('users', 'json');
      users = usersData as any[] || [];
    }
    
    // Filter out user
    const filteredUsers = users.filter(u => u.id !== id);
    
    if (filteredUsers.length === users.length) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (kv) {
      await kv.put('users', JSON.stringify(filteredUsers));
    }
    
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
