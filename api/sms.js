/**
 * Optional SMS endpoint for Missed-Call Text-Back demo.
 * Only sends to TWILIO_OWNER_TEST_NUMBER — never to arbitrary numbers.
 * Demo mode always returns mock success.
 */

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const ownerNumber = process.env.TWILIO_OWNER_TEST_NUMBER;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  const smsBody = body?.body || '(empty)';
  const isDemo = body?.demo !== false;

  if (!accountSid || !authToken || !ownerNumber || !fromNumber) {
    return res.status(200).json({
      sent: true,
      mock: true,
      message: 'Simulated send — Twilio not fully configured for live SMS'
    });
  }

  if (isDemo) {
    return res.status(200).json({
      sent: true,
      mock: true,
      message: 'Demo mode — SMS not delivered to caller. Configure live send by disabling demo flag.'
    });
  }

  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json';
  const params = new URLSearchParams({
    To: ownerNumber,
    From: fromNumber,
    Body: '[Missed-Call Demo] Would have texted caller. Preview: ' + smsBody.slice(0, 160)
  });

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        sent: false,
        error: data.message || 'Twilio SMS failed'
      });
    }

    return res.status(200).json({
      sent: true,
      mock: false,
      sid: data.sid,
      message: 'Notification sent to owner test number'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMS request failed';
    return res.status(502).json({ sent: false, error: message });
  }
}
