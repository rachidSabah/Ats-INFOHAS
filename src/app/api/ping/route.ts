export const runtime = 'edge';

export async function GET() {
  return new Response(JSON.stringify({ ok: true, time: Date.now() }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
