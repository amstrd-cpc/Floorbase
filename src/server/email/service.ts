import { Resend } from 'resend';
import { env } from '@/env';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export async function sendGuestConfirmation(input: {
  to: string;
  guestName: string;
  venueName: string;
  startAt: Date;
  timezone: string;
  partySize: number;
  statusCode: string;
  reservationId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const isPending = input.statusCode === 'PENDING';
  const subject = isPending
    ? `Booking request received — ${input.venueName}`
    : `Reservation confirmed — ${input.venueName}`;

  const statusNote = isPending
    ? `<p>Your booking request is <strong>pending review</strong>. The venue will confirm it shortly.</p>`
    : `<p>Your reservation is <strong>confirmed</strong>. See you then!</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">${subject}</h2>
      <p>Hi ${input.guestName},</p>
      ${statusNote}
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#666;width:140px">Venue</td><td style="padding:6px 0"><strong>${input.venueName}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Date &amp; time</td><td style="padding:6px 0">${formatTime(input.startAt, input.timezone)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Party size</td><td style="padding:6px 0">${input.partySize} ${input.partySize === 1 ? 'guest' : 'guests'}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">If you need to make changes, please contact the venue directly.</p>
    </div>`;

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendGuestConfirmation failed', err);
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const subject = 'Reset your Floorbase password';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">Reset your password</h2>
      <p>We received a request to reset the password for your Floorbase account.</p>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${input.resetUrl}"
         style="display:inline-block;background:#000;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;margin:16px 0">
        Reset password
      </a>
      <p style="color:#666;font-size:13px">If you did not request this, you can safely ignore this email. Your password will not change.</p>
    </div>`;

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendPasswordResetEmail failed', err);
  }
}

export async function sendVenueNewReservationAlert(input: {
  to: string;
  venueName: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  startAt: Date;
  timezone: string;
  partySize: number;
  source: string;
  appUrl: string;
  reservationId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const subject = `New reservation — ${input.guestName} · ${input.partySize}p · ${input.venueName}`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">New reservation</h2>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#666;width:140px">Guest</td><td style="padding:6px 0"><strong>${input.guestName}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Date &amp; time</td><td style="padding:6px 0">${formatTime(input.startAt, input.timezone)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Party size</td><td style="padding:6px 0">${input.partySize}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Email</td><td style="padding:6px 0">${input.guestEmail ?? '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Phone</td><td style="padding:6px 0">${input.guestPhone ?? '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Source</td><td style="padding:6px 0">${input.source}</td></tr>
      </table>
      <a href="${input.appUrl}/admin/reservations/${input.reservationId}"
         style="display:inline-block;background:#000;color:#fff;padding:8px 18px;border-radius:4px;text-decoration:none;font-size:14px">
        Open in Floorbase
      </a>
    </div>`;

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendVenueNewReservationAlert failed', err);
  }
}
