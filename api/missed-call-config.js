/** Public config for Missed-Call Text-Back demo — never exposes secrets. */
export default function handler(_req, res) {
  const twilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID);
  const twilioToken = Boolean(process.env.TWILIO_AUTH_TOKEN);

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    twilioLookupEnabled: twilioSid && twilioToken,
    twilioSmsEnabled: twilioSid && twilioToken && Boolean(process.env.TWILIO_OWNER_TEST_NUMBER),
    ownerTestNumberConfigured: Boolean(process.env.TWILIO_OWNER_TEST_NUMBER)
  });
}
