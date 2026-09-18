/**
 * Optional Twilio Lookup proxy for Missed-Call Text-Back demo.
 * Falls back to 503 when Twilio is not configured — client uses seeded mocks.
 */

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+1' + digits;
  }
  return '+' + digits;
}

function formatDisplay(e164) {
  const digits = e164.replace(/\D/g, '');
  const d = digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) {
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }
  return e164;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return res.status(503).json({
      error: 'Twilio Lookup not configured',
      hint: 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or use client-side mock lookup.'
    });
  }

  const phoneParam = req.query?.phone;
  if (!phoneParam) {
    return res.status(400).json({ error: 'Missing phone query parameter' });
  }

  const e164 = normalizePhone(phoneParam);
  const url = 'https://lookups.twilio.com/v2/PhoneNumbers/' + encodeURIComponent(e164) + '?Fields=line_type_intelligence,caller_name';

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64')
      }
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data.message || 'Twilio Lookup failed',
        code: data.code
      });
    }

    const lineIntel = data.line_type_intelligence || {};
    const callerName = data.caller_name?.caller_name || null;

    return res.status(200).json({
      phone: e164.replace(/\D/g, '').slice(-10),
      phoneDisplay: formatDisplay(e164),
      area: [data.national_format, data.country_code].filter(Boolean).join(' · ') || 'Unknown',
      carrier: lineIntel.carrier_name || 'Unknown carrier',
      callerName: callerName || 'Unknown caller',
      lineType: lineIntel.type || 'Unknown',
      source: 'twilio'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup request failed';
    return res.status(502).json({ error: message });
  }
}
