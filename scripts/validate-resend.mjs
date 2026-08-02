import 'dotenv/config';

const key = process.env.RESEND_API_KEY || '';
const emailFrom = process.env.EMAIL_FROM || '';

console.log('RESEND_API_KEY length:', key.length);
console.log('RESEND_API_KEY starts with re_:', key.startsWith('re_'));
console.log('EMAIL_FROM:', emailFrom);

if (!key) {
  console.log('WARNING: RESEND_API_KEY is empty — emails will be skipped silently');
  process.exit(0);
}

if (!key.startsWith('re_')) {
  console.log('WARNING: Key does not look like a Resend API key (should start with re_)');
  console.log('Email sending will fail at runtime. Please provide a valid Resend API key.');
  process.exit(1);
}

// Test the key with a lightweight Resend API call (list domains)
try {
  const resp = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await resp.json();
  if (resp.ok) {
    console.log('Resend API key is VALID. Domains:', data.data?.map(d => d.name).join(', ') || 'none');
  } else {
    console.log('Resend API key is INVALID:', data.message || JSON.stringify(data));
    process.exit(1);
  }
} catch (err) {
  console.log('Network error validating Resend key:', err.message);
  process.exit(1);
}
