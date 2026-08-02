import 'dotenv/config';
import { Resend } from 'resend';

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || 'Cove Interior <orders@coveinterior.com>';

if (!key) {
  console.error('RESEND_API_KEY not set');
  process.exit(1);
}

const resend = new Resend(key);

const { data, error } = await resend.emails.send({
  from,
  to: 'coveteam7@gmail.com',
  subject: 'Cove Interior — Email Test',
  html: `
    <div style="font-family: 'Montserrat', Arial, sans-serif; background: #1a1a1a; color: #e8dcc8; padding: 40px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #c9a96e; font-size: 24px; letter-spacing: 2px;">COVE INTERIOR</h1>
      <p style="font-size: 16px; line-height: 1.6;">This is a test email confirming that transactional emails are working correctly.</p>
      <p style="font-size: 14px; color: #999;">Sent from: <strong>${from}</strong></p>
      <p style="font-size: 14px; color: #999;">Domain: coveinterior.com — Verified ✓</p>
      <hr style="border-color: #333; margin: 24px 0;" />
      <p style="font-size: 12px; color: #666;">Order confirmation and status update emails are now active.</p>
    </div>
  `,
});

if (error) {
  console.error('Email send FAILED:', JSON.stringify(error, null, 2));
  process.exit(1);
} else {
  console.log('Email sent successfully! ID:', data.id);
  console.log('From:', from);
  console.log('To: coveteam7@gmail.com');
}
