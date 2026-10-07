import nodemailer from 'nodemailer';
import { getAdminAuthInstance, getAdminFirestoreInstance } from '../_utils/firebaseAdmin';

// Authoritative internal staff directory to prevent browser spoofing
export const TRUSTED_COUNSELLOR_DIRECTORY: Record<string, { name: string; email: string }> = {
  'counsellor-benjamin': { name: 'Benjamin', email: 'benjamin@gamblepause.org' },
  'counsellor-micheal': { name: 'Micheal Akinniku', email: 'micheal.akinniku@gamblepause.org' },
  'counsellor-celia': { name: 'Celia Badmus', email: 'celia.badmus@gamblepause.org' },
  'staff-superadmin': { name: 'Abiodun Ayodeji', email: 'ayodejiharbiodun24@gmail.com' },
  'staff-superadmin-2': { name: 'Ladipo Abiose', email: 'ladipo.abiose@gamblepause.org' },
};

// Authorized Super Admin emails for admin actions & transport testing
const SUPER_ADMIN_EMAILS = [
  'ayodejiharbiodun24@gmail.com',
  'ladipo.abiose@gamblepause.org',
  'stevobenjo@gmail.com',
];

// In-memory set for concurrency deduplication
const sentOrInFlightNotificationIds = new Set<string>();

/**
 * Mask an email address for privacy in logs and UI responses (e.g. ay***@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const visible = local.substring(0, 2);
  const asterisks = '*'.repeat(Math.min(6, Math.max(2, local.length - 2)));
  return `${visible}${asterisks}@${domain}`;
}

/**
 * Validates basic email formatting
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Sanitize error message so credentials or tokens are never leaked
 */
function sanitizeErrorMessage(err: any): string {
  const msg = err?.message || String(err);
  return msg
    .replace(/(password|pass|secret|key|token)=['"]?[^'"\s]+['"]?/gi, '$1=***')
    .substring(0, 300);
}

/**
 * Creates Nodemailer transporter using configured SMTP environment variables
 */
function createSmtpTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Vercel Serverless Function & Express Route Handler
 * POST /api/notifications/send-counsellor-email
 * POST /api/send-counsellor-email
 */
export default async function handler(req: any, res: any) {
  // CORS Headers support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle browser preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  console.log(`[Serverless Email API] Incoming request received. Method: ${req.method}, Path: ${req.url}`);

  // 1. Method verification
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({
      success: false,
      stage: 'method_validation',
      error: `Method ${req.method} Not Allowed. Only POST is accepted.`,
    });
  }

  // 2. Content-Type verification
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(400).json({
      success: false,
      stage: 'content_type_validation',
      error: 'Invalid Content-Type. application/json is required.',
    });
  }

  // 3. Authenticate caller via Firebase ID Token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[Serverless Email API] Authentication failed: Missing or invalid Authorization header.');
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: 'Unauthorized: Missing or invalid Authorization header. Expected Bearer <Firebase ID Token>.',
    });
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    console.warn('[Serverless Email API] Authentication failed: Empty Bearer token.');
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: 'Unauthorized: Empty Firebase ID token.',
    });
  }

  let decodedToken: any;
  try {
    const adminAuth = getAdminAuthInstance();
    decodedToken = await adminAuth.verifyIdToken(idToken);
    console.log('[Serverless Email API] Authentication success: Token cryptographically verified via Firebase Admin.');
  } catch (err: any) {
    console.error('[Serverless Email API] Authentication failed: Token verification error:', err?.message || err);
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: `Unauthorized: Invalid or expired Firebase ID token (${err?.message || 'verification_failed'}).`,
    });
  }

  const callerUid = decodedToken.uid;
  const callerEmail = (decodedToken.email || '').toLowerCase().trim();

  const body = req.body || {};
  const {
    notificationId,
    clientId,
    counsellorId,
    actionType,
    isTest,
    testRecipient,
    previousCounsellorName,
    newCounsellorName,
    reason,
    recipientEmail,
    clientName,
    assessmentName,
    assessmentLink,
    type,
  } = body;

  // =========================================================================
  // 4. Genuine SMTP Test Execution Mode (Super Admin Restricted)
  // =========================================================================
  if (isTest === true || actionType === 'test') {
    const isSuperAdmin =
      SUPER_ADMIN_EMAILS.includes(callerEmail) ||
      callerEmail.endsWith('@gamblepause.org') ||
      decodedToken.role === 'Super Admin';

    if (!isSuperAdmin) {
      console.warn(`[Serverless Email API] Test rejected: Caller ${callerEmail || callerUid} is not authorized for SMTP testing.`);
      return res.status(403).json({
        success: false,
        stage: 'authorization',
        error: 'Forbidden: SMTP transport verification is restricted to Super Admin accounts.',
      });
    }

    console.log('[Serverless Email API] Initiating genuine SMTP test send...');

    // Verify SMTP Configuration exists
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn('[Serverless Email API] SMTP configuration missing: SMTP_USER or SMTP_PASSWORD not set.');
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: 'SMTP transport is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables in Vercel.',
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    // Resolve target recipient
    const targetRecipient = (testRecipient || callerEmail || process.env.SMTP_USER || '').trim().toLowerCase();
    if (!isValidEmail(targetRecipient)) {
      console.warn(`[Serverless Email API] Test rejected: Invalid recipient email "${targetRecipient}".`);
      return res.status(400).json({
        success: false,
        stage: 'payload_validation',
        error: `Invalid test recipient email address: "${targetRecipient}". Please provide a valid email format.`,
      });
    }

    // Step 1: Verify SMTP Server Connection
    try {
      console.log('[Serverless Email API] Testing SMTP connection handshake with server...');
      await transporter.verify();
      console.log('[Serverless Email API] SMTP connection handshake successful.');
    } catch (verifyErr: any) {
      const sanitized = sanitizeErrorMessage(verifyErr);
      console.error('[Serverless Email API] SMTP handshake failed:', sanitized);
      return res.status(500).json({
        success: false,
        stage: 'smtp_connection',
        error: `SMTP connection or authentication failed: ${sanitized}`,
        recipient: maskEmail(targetRecipient),
      });
    }

    // Step 2: Send REAL test email to target recipient
    const masked = maskEmail(targetRecipient);
    const fromAddress = process.env.SMTP_USER;
    const testSubject = '[SMTP Test] GamblePause Email Gateway Verification';
    const testTimestamp = new Date().toISOString();
    const testDateFormatted = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const testText = `GamblePause Initiative Africa - SMTP Gateway Test

Hello,

This is a real diagnostic verification email sent from the GamblePause Vercel Serverless Email Engine.

- Status: SMTP Gateway Connected & Dispatched
- Destination Recipient: ${masked}
- Server Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '465'}
- Timestamp: ${testTimestamp} (${testDateFormatted} West Africa Time)

If you are receiving this message, your Gmail/SMTP credentials and serverless dispatch pipeline are functioning correctly.

Warm regards,
GamblePause Technical Team`;

    const testHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
  <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">GAMBLE<span style="color: #1f2937;">PAUSE</span></h2>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">SMTP Email Gateway Diagnostic Verification</p>
  </div>
  <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
    <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: 700;">
      ✓ Real SMTP Delivery Confirmed
    </p>
    <p style="margin: 4px 0 0 0; color: #047857; font-size: 13px;">
      This email was successfully processed and dispatched via Nodemailer through the GamblePause Vercel/Express backend.
    </p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600; width: 140px;">Recipient:</td>
      <td style="padding: 8px 0; color: #111827; font-family: monospace;">${masked}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">SMTP Host:</td>
      <td style="padding: 8px 0; color: #111827; font-family: monospace;">${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '465'}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Dispatch Time:</td>
      <td style="padding: 8px 0; color: #111827;">${testDateFormatted} (WAT)</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Security:</td>
      <td style="padding: 8px 0; color: #059669; font-weight: bold;">SSL / TLS Encrypted (Port 465)</td>
    </tr>
  </table>
  <p style="font-size: 13px; color: #4b5563;">
    All automated email dispatch triggers (counsellor assignments, client assessment check-ins, and overdue reminders) are ready for real operational use.
  </p>
  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
    <strong>GamblePause Initiative Africa</strong> &bull; Confidential & Automated System Notification
  </div>
</div>`;

    try {
      console.log(`[Serverless Email API] Dispatching real test email to ${targetRecipient}...`);
      const info = await transporter.sendMail({
        from: `"GamblePause Initiative Africa" <${fromAddress}>`,
        to: targetRecipient,
        subject: testSubject,
        text: testText,
        html: testHtml,
      });

      console.log(`[Serverless Email API] Real test email delivered successfully. MessageID: ${info.messageId}`);

      return res.status(200).json({
        success: true,
        stage: 'smtp_send_success',
        message: 'Email sent successfully via SMTP',
        recipient: masked,
        messageId: info.messageId,
        accepted: info.accepted,
      });
    } catch (sendErr: any) {
      const sanitized = sanitizeErrorMessage(sendErr);
      console.error(`[Serverless Email API] SMTP sendMail failed to ${targetRecipient}:`, sanitized);
      return res.status(500).json({
        success: false,
        stage: 'smtp_send_failure',
        error: `SMTP delivery failed: ${sanitized}`,
        recipient: masked,
      });
    }
  }

  // =========================================================================
  // 5. Assessment Availability & Client Reminder Mode
  // =========================================================================
  if (
    actionType === 'assessment' ||
    actionType === 'assessment_reminder' ||
    actionType === 'assessment_ready' ||
    actionType === 'welcome'
  ) {
    const targetEmail = (recipientEmail || body.recipient || '').trim().toLowerCase();
    if (!isValidEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        stage: 'payload_validation',
        error: `Invalid recipient email address for assessment notification: "${targetEmail}".`,
      });
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: 'SMTP transport is not configured. Please configure SMTP_USER and SMTP_PASSWORD in Vercel.',
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    const recipientDisplayName = clientName || 'Client';
    const clientFirstName = recipientDisplayName.split(' ')[0] || 'Friend';
    const currentAssessmentName = assessmentName || 'Clinical Check-in';
    const link = assessmentLink || 'https://gamblepause.org/?view=client-assessment';
    const subType = type || actionType;

    let emailSubject = `GamblePause: Your ${currentAssessmentName} is Ready`;
    let emailHeading = 'Assessment Check-in Available';
    let emailBody = `Hello ${clientFirstName},\n\nYour scheduled GamblePause check-in (${currentAssessmentName}) is ready. Please take 2-3 minutes to complete it confidentially: ${link}\n\nWarm regards,\nGamblePause Initiative Africa`;

    if (subType === 'welcome') {
      emailSubject = 'Welcome to GamblePause Initiative Africa';
      emailHeading = 'Welcome to GamblePause';
      emailBody = `Hello ${clientFirstName},\n\nThank you for reaching out to GamblePause. Your confidential record has been created and your initial check-in is ready.\n\nPlease complete it here: ${link}\n\nWarm regards,\nGamblePause Initiative Africa`;
    } else if (subType === 'reminder_24h') {
      emailSubject = `Reminder: Your GamblePause ${currentAssessmentName}`;
      emailHeading = 'Gentle Assessment Reminder';
      emailBody = `Hello ${clientFirstName},\n\nThis is a gentle reminder that your ${currentAssessmentName} is awaiting completion: ${link}\n\nWarm regards,\nGamblePause Initiative Africa`;
    } else if (subType === 'overdue') {
      emailSubject = `Urgent: GamblePause Check-in Support for ${clientFirstName}`;
      emailHeading = 'Overdue Check-in Notification';
      emailBody = `Hello ${clientFirstName},\n\nYour ${currentAssessmentName} is currently past due. Your assigned counsellor is on standby to support you.\n\nPlease complete your check-in here: ${link}\n\nWarm regards,\nGamblePause Initiative Africa`;
    }

    const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
  <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 800;">GAMBLE<span style="color: #1f2937;">PAUSE</span></h2>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${emailHeading}</p>
  </div>
  <p style="font-size: 15px;">Hello <strong>${clientFirstName}</strong>,</p>
  <p style="font-size: 15px; color: #374151;">
    ${subType === 'overdue' 
      ? `Your scheduled assessment (<strong>${currentAssessmentName}</strong>) is currently past due. Checking in helps your counsellor tailor care without judgment.`
      : `Your confidential check-in (<strong>${currentAssessmentName}</strong>) is available for you.`}
  </p>
  <div style="margin: 28px 0; text-align: center;">
    <a href="${link}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; shadow: 0 2px 4px rgba(220, 38, 38, 0.2);">Complete Assessment Confidentially</a>
  </div>
  <p style="font-size: 12px; color: #6b7280; text-align: center;">
    Direct link: <a href="${link}" style="color: #dc2626;">${link}</a>
  </p>
  <div style="margin-top: 32px; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; padding-top: 16px;">
    <strong>GamblePause Initiative Africa</strong><br>
    Helpline: +234 800-GAMBLE-PAUSE (Toll-Free)<br>
    <span style="color: #9ca3af;">Your responses and information remain strictly confidential.</span>
  </div>
</div>`;

    try {
      console.log(`[Serverless Email API] Dispatching assessment notification to ${targetEmail}...`);
      const info = await transporter.sendMail({
        from: `"GamblePause Initiative Africa" <${process.env.SMTP_USER}>`,
        to: targetEmail,
        subject: emailSubject,
        text: emailBody,
        html: emailHtml,
      });

      console.log(`[Serverless Email API] Assessment email dispatched to ${targetEmail}. MessageID: ${info.messageId}`);
      return res.status(200).json({
        success: true,
        stage: 'dispatched',
        message: `Assessment notification email dispatched successfully to ${maskEmail(targetEmail)}.`,
        messageId: info.messageId,
      });
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err);
      console.error(`[Serverless Email API] Assessment email failed to ${targetEmail}:`, sanitized);
      return res.status(500).json({
        success: false,
        stage: 'smtp_send',
        error: `Failed to dispatch assessment email via SMTP: ${sanitized}`,
      });
    }
  }

  // =========================================================================
  // 6. Counsellor Assignment & Reassignment Notification Mode
  // =========================================================================
  if (!notificationId || !clientId || !counsellorId) {
    console.warn('[Serverless Email API] Payload validation failed: missing notificationId, clientId, or counsellorId.');
    return res.status(400).json({
      success: false,
      stage: 'payload_validation',
      error: 'Missing required parameters: notificationId, clientId, and counsellorId are mandatory.',
    });
  }

  console.log(`[Serverless Email API] Processing email dispatch for client: ${clientId}, counsellor: ${counsellorId}, notif: ${notificationId}, action: ${actionType || 'assignment'}`);

  // Check 6a: Concurrency deduplication (in-memory)
  if (sentOrInFlightNotificationIds.has(notificationId)) {
    console.log(`[Serverless Email API] Idempotency notice: Notification ${notificationId} is already in-flight or sent.`);
    return res.status(200).json({
      success: true,
      stage: 'idempotency',
      message: 'Email already sent or currently being processed for this notification.',
      alreadySent: true,
    });
  }

  // Check 6b: Firestore-backed email status verification
  const adminDb = getAdminFirestoreInstance();
  if (adminDb) {
    try {
      const notifRef = adminDb.collection('notifications').doc(notificationId);
      const notifSnap = await notifRef.get();
      if (notifSnap.exists) {
        const notifData = notifSnap.data();
        if (notifData && notifData.emailStatus === 'sent') {
          sentOrInFlightNotificationIds.add(notificationId);
          console.log(`[Serverless Email API] Idempotency notice: Firestore records notification ${notificationId} as already sent.`);
          return res.status(200).json({
            success: true,
            stage: 'idempotency',
            message: 'Email already sent for this notification record.',
            alreadySent: true,
            emailSentAt: notifData.emailSentAt,
          });
        }
      }
    } catch (e: any) {
      console.warn('[Serverless Email API] Firestore idempotency check notice:', e?.message || e);
    }
  }

  // 7. Authoritatively resolve the assigned counsellor details
  let counsellorName = '';
  let counsellorEmail = '';

  // First check trusted static directory
  const knownCounsellor = TRUSTED_COUNSELLOR_DIRECTORY[counsellorId];
  if (knownCounsellor) {
    counsellorName = knownCounsellor.name;
    counsellorEmail = knownCounsellor.email;
  }

  // If not found in static directory, check Firestore staff collection
  if (!counsellorEmail && adminDb) {
    try {
      const staffDoc = await adminDb.collection('staff').doc(counsellorId).get();
      if (staffDoc.exists) {
        const sData = staffDoc.data();
        if (sData && sData.role === 'Counsellor' && sData.email) {
          counsellorName = sData.name || 'Counsellor';
          counsellorEmail = sData.email;
        }
      }
    } catch (e) {
      console.warn('[Serverless Email API] Error querying Firestore staff collection:', e);
    }
  }

  if (!counsellorEmail) {
    console.warn(`[Serverless Email API] Counsellor resolution failed: Unrecognized counsellor ID "${counsellorId}".`);
    return res.status(400).json({
      success: false,
      stage: 'counsellor_resolution',
      error: `Unrecognized or unauthorized counsellor ID: "${counsellorId}". Email recipient cannot be resolved from trusted staff records.`,
    });
  }

  console.log(`[Serverless Email API] Resolved counsellor: ${counsellorName} <${counsellorEmail}>`);

  // 8. Confirm client assignment if Firestore is available and this is a new assignment to this counsellor
  if (adminDb && actionType !== 'reassignment_previous') {
    try {
      const clientDoc = await adminDb.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const cData = clientDoc.data();
        if (cData && cData.assignedCounsellorId && cData.assignedCounsellorId !== counsellorId) {
          console.warn(`[Serverless Email API] Assignment mismatch: Client ${clientId} is assigned to ${cData.assignedCounsellorId}, not ${counsellorId}.`);
          return res.status(400).json({
            success: false,
            stage: 'assignment_verification',
            error: `Mismatched assignment: client ${clientId} is currently assigned to ${cData.assignedCounsellorId}, not ${counsellorId}.`,
          });
        }
      }
    } catch (e) {
      console.warn('[Serverless Email API] Client verification notice:', e);
    }
  }

  // 9. Check SMTP transport configuration
  const transporter = createSmtpTransporter();
  if (!transporter) {
    console.warn('[Serverless Email API] SMTP configuration missing: SMTP_USER or SMTP_PASSWORD is not set in environment.');
    return res.status(503).json({
      success: false,
      stage: 'smtp_config',
      error: 'SMTP transport is not configured. Please configure SMTP_USER and SMTP_PASSWORD in Vercel environment variables.',
      code: 'SMTP_NOT_CONFIGURED',
    });
  }

  // Mark as in-flight
  sentOrInFlightNotificationIds.add(notificationId);

  // 10. Construct strictly bounded email message (NO clinical or sensitive data)
  const fromAddress = process.env.SMTP_USER;
  let emailSubject = 'New Client Assigned — GamblePause';
  let emailHeading = 'Counsellor Caseload Notification';
  let emailText = `Hello ${counsellorName},\n\nA new client (${clientId}) has been assigned to your caseload.\n\nPlease sign in to the GamblePause Counsellor Portal to view the client and review their clinical schedule.\n\nWarm regards,\nGamblePause Initiative Africa`;

  if (actionType === 'reassignment') {
    emailSubject = `Client Reassigned to Your Caseload — GamblePause (${clientId})`;
    emailHeading = 'Caseload Reassignment Notification';
    emailText = `Hello ${counsellorName},\n\nClient (${clientId}) has been reassigned to your caseload${previousCounsellorName ? ` from ${previousCounsellorName}` : ''}.${reason ? ` Reason: ${reason}` : ''}\n\nPlease sign in to the GamblePause Counsellor Portal to review their active profile.\n\nWarm regards,\nGamblePause Initiative Africa`;
  } else if (actionType === 'reassignment_previous') {
    emailSubject = `Client Transferred from Caseload — GamblePause (${clientId})`;
    emailHeading = 'Client Transfer Notice';
    emailText = `Hello ${counsellorName},\n\nPlease be advised that client (${clientId}) has been transferred to counsellor ${newCounsellorName || 'another counsellor'}.${reason ? ` Reason: ${reason}` : ''}\n\nWarm regards,\nGamblePause Initiative Africa`;
  }

  const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
  <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 700;">GamblePause Initiative Africa</h2>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${emailHeading}</p>
  </div>
  <p style="font-size: 15px;">Hello ${counsellorName},</p>
  ${
    actionType === 'reassignment'
      ? `<p style="font-size: 15px;">Client <strong>${clientId}</strong> has been transferred and reassigned to your caseload${previousCounsellorName ? ` (previously with <strong>${previousCounsellorName}</strong>)` : ''}.</p>
         ${reason ? `<p style="font-size: 14px; color: #4b5563; background-color: #f9fafb; padding: 10px 14px; border-left: 3px solid #dc2626; border-radius: 4px;"><strong>Administrative Note:</strong> ${reason}</p>` : ''}`
      : actionType === 'reassignment_previous'
      ? `<p style="font-size: 15px;">Please be advised that client <strong>${clientId}</strong> has been transferred from your caseload to counsellor <strong>${newCounsellorName || 'another counsellor'}</strong>.</p>
         ${reason ? `<p style="font-size: 14px; color: #4b5563; background-color: #f9fafb; padding: 10px 14px; border-left: 3px solid #6b7280; border-radius: 4px;"><strong>Transfer Reason:</strong> ${reason}</p>` : ''}`
      : `<p style="font-size: 15px;">A new client (<strong>${clientId}</strong>) has been assigned to your caseload.</p>`
  }
  <p style="font-size: 15px;">Please sign in to the GamblePause Counsellor Portal to view the client and review their clinical schedule.</p>
  <div style="margin: 28px 0;">
    <a href="https://gamblepause.org" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Sign in to Counsellor Portal</a>
  </div>
  <p style="margin-top: 32px; font-size: 13px; color: #4b5563; border-top: 1px solid #f3f4f6; padding-top: 16px;">
    Warm regards,<br>
    <strong>GamblePause Initiative Africa</strong><br>
    <span style="color: #9ca3af; font-size: 12px;">This is an automated notification. Confidential client details are accessible only after authenticating into the Counsellor Portal.</span>
  </p>
</div>`;

  // 11. Dispatch email via Nodemailer
  try {
    console.log(`[Serverless Email API] Sending email via SMTP to ${counsellorEmail}...`);
    const info = await transporter.sendMail({
      from: `"GamblePause Initiative Africa" <${fromAddress}>`,
      to: counsellorEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    console.log(`[Serverless Email API] Email dispatched successfully to ${counsellorEmail} for client ${clientId}. MessageID: ${info.messageId}`);

    // Update Firestore notification record with idempotency tracking
    if (adminDb) {
      try {
        await adminDb.collection('notifications').doc(notificationId).set(
          {
            emailStatus: 'sent',
            emailSentAt: new Date().toISOString(),
            emailMessageId: info.messageId || '',
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('[Serverless Email API] Failed to update emailStatus in Firestore:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      stage: 'dispatched',
      message: `Counsellor notification email dispatched successfully to ${counsellorName}.`,
      messageId: info.messageId,
      recipient: maskEmail(counsellorEmail),
    });
  } catch (sendErr: any) {
    // Release in-flight flag so it can be retried
    sentOrInFlightNotificationIds.delete(notificationId);
    const sanitized = sanitizeErrorMessage(sendErr);
    console.error(`[Serverless Email API] SMTP send error to ${counsellorEmail}:`, sanitized);

    if (adminDb) {
      try {
        await adminDb.collection('notifications').doc(notificationId).set(
          {
            emailStatus: 'failed',
            emailLastError: sanitized,
            emailLastAttempt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    }

    return res.status(500).json({
      success: false,
      stage: 'smtp_send',
      error: `Failed to dispatch email via SMTP: ${sanitized}`,
      recipient: maskEmail(counsellorEmail),
    });
  }
}
