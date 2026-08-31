import { Resend } from 'resend';
import type { NotificationStatus } from '@prisma/client';
import { env } from '@/env';
import { prisma } from '@/server/db/prisma/client';

let _resend: Resend | null = null;

async function logNotification(input: {
  organizationId: string;
  reservationId?: string;
  guestId?: string;
  templateKey: string;
  recipient: string;
  status: NotificationStatus;
  errorMessage?: string;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        organizationId: input.organizationId,
        reservationId: input.reservationId,
        guestId: input.guestId,
        channel: 'EMAIL',
        templateKey: input.templateKey,
        recipient: input.recipient,
        status: input.status,
        provider: 'resend',
        errorMessage: input.errorMessage,
        sentAt: input.status === 'SENT' ? new Date() : null
      }
    });
  } catch (err) {
    console.error('Failed to write notification log', err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
    minute: '2-digit'
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
  organizationId: string;
  guestId?: string;
}) {
  const resend = getResend();
  if (!resend) {
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'guest_confirmation',
      recipient: input.to,
      status: 'SKIPPED'
    });
    return;
  }

  const isPending = input.statusCode === 'PENDING';
  const safeVenueName = escapeHtml(input.venueName);
  const safeGuestName = escapeHtml(input.guestName);
  const subject = isPending
    ? `Booking request received — ${input.venueName}`
    : `Reservation confirmed — ${input.venueName}`;

  const statusNote = isPending
    ? `<p>Your booking request is <strong>pending review</strong>. The venue will confirm it shortly.</p>`
    : `<p>Your reservation is <strong>confirmed</strong>. See you then!</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">${escapeHtml(subject)}</h2>
      <p>Hi ${safeGuestName},</p>
      ${statusNote}
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#666;width:140px">Venue</td><td style="padding:6px 0"><strong>${safeVenueName}</strong></td></tr>
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
      html
    });
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'guest_confirmation',
      recipient: input.to,
      status: 'SENT'
    });
  } catch (err) {
    console.error('sendGuestConfirmation failed', err);
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'guest_confirmation',
      recipient: input.to,
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function sendGuestReminder(input: {
  to: string;
  guestName: string;
  venueName: string;
  startAt: Date;
  timezone: string;
  partySize: number;
  reservationId: string;
  organizationId: string;
  guestId?: string;
}) {
  const resend = getResend();
  if (!resend) {
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'reservation_reminder',
      recipient: input.to,
      status: 'SKIPPED'
    });
    return;
  }

  const safeVenueName = escapeHtml(input.venueName);
  const safeGuestName = escapeHtml(input.guestName);
  const subject = `Reminder: your reservation at ${input.venueName}`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">${escapeHtml(subject)}</h2>
      <p>Hi ${safeGuestName},</p>
      <p>Just a reminder about your upcoming reservation.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#666;width:140px">Venue</td><td style="padding:6px 0"><strong>${safeVenueName}</strong></td></tr>
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
      html
    });
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'reservation_reminder',
      recipient: input.to,
      status: 'SENT'
    });
  } catch (err) {
    console.error('sendGuestReminder failed', err);
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'reservation_reminder',
      recipient: input.to,
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : 'Unknown error'
    });
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
      html
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
  organizationId: string;
  guestId?: string;
}) {
  const resend = getResend();
  if (!resend) {
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'venue_new_reservation_alert',
      recipient: input.to,
      status: 'SKIPPED'
    });
    return;
  }

  const safeGuestName = escapeHtml(input.guestName);
  const safeVenueName = escapeHtml(input.venueName);
  const subject = `New reservation — ${input.guestName} · ${input.partySize}p · ${input.venueName}`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:4px">New reservation</h2>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#666;width:140px">Guest</td><td style="padding:6px 0"><strong>${safeGuestName}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Date &amp; time</td><td style="padding:6px 0">${formatTime(input.startAt, input.timezone)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Party size</td><td style="padding:6px 0">${input.partySize}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Email</td><td style="padding:6px 0">${input.guestEmail ? escapeHtml(input.guestEmail) : '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Phone</td><td style="padding:6px 0">${input.guestPhone ? escapeHtml(input.guestPhone) : '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Source</td><td style="padding:6px 0">${escapeHtml(input.source)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#666">Venue</td><td style="padding:6px 0">${safeVenueName}</td></tr>
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
      html
    });
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'venue_new_reservation_alert',
      recipient: input.to,
      status: 'SENT'
    });
  } catch (err) {
    console.error('sendVenueNewReservationAlert failed', err);
    await logNotification({
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestId: input.guestId,
      templateKey: 'venue_new_reservation_alert',
      recipient: input.to,
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}
