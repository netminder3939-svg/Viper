// Viper OS — real email & SMS sender (optional).
// Works with Resend (email) and Twilio (SMS). If the relevant keys are not
// set, it returns { simulated: true } and the app just logs to the Outbox.
//
// Set in Vercel → Settings → Environment Variables:
//   Email (Resend):  RESEND_API_KEY, MAIL_FROM   (e.g. "Viper Electric <office@yourdomain.com>")
//   SMS  (Twilio):   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM  (your Twilio number)
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const { channel, to, subject, body } = req.body || {};
  try {
    if (channel === 'sms') {
      const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
      if (!sid || !tok || !from || !to) { res.status(200).json({ simulated: true, reason: 'twilio-not-configured' }); return; }
      const auth = Buffer.from(sid + ':' + tok).toString('base64');
      const form = new URLSearchParams({ To: to, From: from, Body: body || '' });
      const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
        method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
      });
      res.status(200).json({ sent: r.ok, channel: 'sms' });
      return;
    }
    // default: email via Resend
    const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
    if (!key || !from || !to) { res.status(200).json({ simulated: true, reason: 'resend-not-configured' }); return; }
    const html = '<div style="font-family:Inter,Arial,sans-serif;line-height:1.6">' + String(body || '').replace(/\n/g, '<br>') + '</div>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: subject || 'Message from Viper OS', html })
    });
    res.status(200).json({ sent: r.ok, channel: 'email' });
  } catch (e) {
    res.status(200).json({ simulated: true, error: String(e && e.message || e) });
  }
}
