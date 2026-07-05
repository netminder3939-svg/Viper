// Vercel serverless proxy for the Viper assistant.
// Keeps your Anthropic API key server-side. Set ANTHROPIC_API_KEY in
// Vercel → Settings → Environment Variables, then redeploy.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ reply: null }); return; } // triggers offline demo mode in the app
  try {
    const { message, system } = req.body || {};
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: system || 'You are a helpful business assistant.',
        messages: [{ role: 'user', content: String(message || '') }]
      })
    });
    const data = await r.json();
    const reply = data && data.content && data.content[0] ? data.content[0].text : null;
    res.status(200).json({ reply: reply });
  } catch (e) {
    res.status(200).json({ reply: null });
  }
}
