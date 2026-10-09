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

// Ephemeral in-flight set for serverless request concurrency protection
const inFlightNotificationIds = new Set<string>();

/**
 * Mask an email address for privacy in logs and UI responses (e.g. ay******@gmail.com)
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
 * Sanitize error message so passwords, keys, or tokens are never leaked
 */
export function sanitizeErrorMessage(err: any): string {
  const msg = err?.message || String(err || '');
  return msg
    .replace(/(password|pass|secret|key|token)=['"]?[^'"\s]+['"]?/gi, '$1=***')
    .substring(0, 300);
}

/**
 * Maps common SMTP transport errors into clean, user-friendly diagnostic messages and error codes
 */
export function mapSmtpError(err: any): { code: string; message: string; stage: string } {
  const rawCode = (err?.code || '').toUpperCase();
  const rawMsg = err?.message || String(err || '');

  // 1. Authentication failure
  if (
    rawCode === 'EAUTH' ||
    rawMsg.includes('Invalid login') ||
    rawMsg.includes('Username and Password not accepted') ||
    rawMsg.includes('535') ||
    rawMsg.includes('BadCredentials')
  ) {
    return {
      stage: 'smtp_auth',
      code: 'SMTP_AUTH_FAILED',
      message: 'SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD (ensure Google App Password is used without spaces).',
    };
  }

  // 2. Network/connection failure
  if (
    rawCode === 'ECONNECTION' ||
    rawCode === 'ETIMEDOUT' ||
    rawCode === 'ECONNREFUSED' ||
    rawCode === 'ENOTFOUND' ||
    rawMsg.includes('ETIMEDOUT') ||
    rawMsg.includes('ECONNREFUSED') ||
    rawMsg.includes('getaddrinfo')
  ) {
    return {
      stage: 'smtp_connection',
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP server connection failed. Check SMTP_HOST, SMTP_PORT and network access.',
    };
  }

  // 3. Recipient/Envelope failure
  if (rawCode === 'EENVELOPE' || rawMsg.includes('No recipients defined')) {
    return {
      stage: 'smtp_recipient',
      code: 'SMTP_INVALID_RECIPIENT',
      message: 'SMTP delivery rejected: invalid or missing recipient email address.',
    };
  }

  // 4. General send failure
  return {
    stage: 'smtp_send_failure',
    code: 'SMTP_SEND_FAILED',
    message: `SMTP accepted the connection but the message could not be sent: ${sanitizeErrorMessage(err)}`,
  };
}

/**
 * Reads, validates, and normalizes SMTP configuration from process.env
 */
export function getSmtpConfig() {
  const rawUser = (
    process.env.SMTP_USER ||
    process.env.SMTP_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER ||
    ''
  ).trim();
  const rawPass = (
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASSWORD ||
    process.env.MAIL_PASSWORD ||
    ''
  ).trim();
  const user = rawUser.replace(/^["']|["']$/g, '').trim();
  // Strip quotes and internal spaces (e.g. Google App Password copied with 4-letter grouping)
  const pass = rawPass.replace(/^["']|["']$/g, '').replace(/\s+/g, '').trim();
  const rawHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const host = rawHost.replace(/^["']|["']$/g, '').trim();

  // Safely normalize port as number
  const rawPort = process.env.SMTP_PORT;
  const parsedPort = rawPort ? parseInt(rawPort.replace(/^["']|["']$/g, '').trim(), 10) : 465;
  const port = isNaN(parsedPort) ? 465 : parsedPort;

  // Safely normalize secure as boolean
  const rawSecure = process.env.SMTP_SECURE;
  const cleanSecure = rawSecure ? rawSecure.replace(/^["']|["']$/g, '').trim().toLowerCase() : undefined;
  const secure = cleanSecure !== undefined
    ? (cleanSecure === 'true' || cleanSecure === '1' || cleanSecure === 'yes')
    : (port === 465);

  const missing: string[] = [];
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASSWORD');

  return {
    user,
    pass,
    host,
    port,
    secure,
    missing,
    isConfigured: missing.length === 0,
  };
}

/**
 * Creates Nodemailer transporter using normalized SMTP configuration
 */
export function createSmtpTransporter() {
  const config = getSmtpConfig();
  if (!config.isConfigured) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * Vercel Serverless Function & Express Route Handler
 * POST /api/notifications/send-counsellor-email
 * POST /api/send-counsellor-email
 * POST /api/notifications/send-email
 * POST /api/send-email
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

  // 1. Method verification
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({
      success: false,
      stage: 'method_validation',
      error: `Method ${req.method} Not Allowed. Only POST is accepted.`,
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // 2. Content-Type verification
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(400).json({
      success: false,
      stage: 'content_type_validation',
      error: 'Invalid Content-Type. application/json is required.',
      code: 'INVALID_CONTENT_TYPE',
    });
  }

  // 3. Authenticate caller via Firebase ID Token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: 'Unauthorized: Missing or invalid Authorization header. Expected Bearer <Firebase ID Token>.',
      code: 'UNAUTHORIZED',
    });
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: 'Unauthorized: Empty Firebase ID token.',
      code: 'UNAUTHORIZED',
    });
  }

  let decodedToken: any;
  try {
    const adminAuth = getAdminAuthInstance();
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err: any) {
    const sanitizedAuthErr = sanitizeErrorMessage(err);
    console.warn('[Serverless Email API] Authentication token verification error:', sanitizedAuthErr);
    return res.status(401).json({
      success: false,
      stage: 'authentication',
      error: `Unauthorized: Invalid or expired Firebase ID token (${sanitizedAuthErr}).`,
      code: 'INVALID_TOKEN',
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

  const smtpConfig = getSmtpConfig();

  // =========================================================================
  // 4. Real SMTP Diagnostic Test Mode (Super Admin Restricted)
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
        code: 'FORBIDDEN',
      });
    }

    // Check configuration
    if (!smtpConfig.isConfigured) {
      console.warn(`[Serverless Email API] SMTP configuration missing: ${smtpConfig.missing.join(', ')}`);
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    // Resolve target recipient from request or caller
    const targetRecipient = (testRecipient || callerEmail || smtpConfig.user || '').trim().toLowerCase();
    if (!isValidEmail(targetRecipient)) {
      return res.status(400).json({
        success: false,
        stage: 'payload_validation',
        error: `Invalid test recipient email address: "${targetRecipient}". Please provide a valid email format.`,
        code: 'INVALID_RECIPIENT',
      });
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    // Step 4a: Verify connection with SMTP server
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      const mapped = mapSmtpError(verifyErr);
      console.warn('[Serverless Email API] Diagnostic SMTP handshake notice:', mapped.message);
      return res.status(500).json({
        success: false,
        stage: mapped.stage,
        error: mapped.message,
        code: mapped.code,
        recipient: maskEmail(targetRecipient),
      });
    }

    // Step 4b: Send REAL test email to target recipient
    const masked = maskEmail(targetRecipient);
    const testSubject = '[SMTP Verification] GamblePause Email Gateway Test';
    const testTimestamp = new Date().toISOString();
    const testDateFormatted = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const testText = `GamblePause Initiative Africa - SMTP Gateway Test

Hello,

This is a live diagnostic verification email dispatched from the GamblePause Serverless Email Gateway.

- Status: SMTP message accepted by SMTP transport
- Recipient: ${masked}
- SMTP Host: ${smtpConfig.host}:${smtpConfig.port}
- Dispatch Timestamp: ${testTimestamp} (${testDateFormatted} West Africa Time)

If you have received this message, the SMTP server accepted and processed the transmission successfully.

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
      This email was successfully dispatched and accepted by the SMTP transport via Nodemailer.
    </p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600; width: 140px;">Recipient:</td>
      <td style="padding: 8px 0; color: #111827; font-family: monospace;">${masked}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">SMTP Host:</td>
      <td style="padding: 8px 0; color: #111827; font-family: monospace;">${smtpConfig.host}:${smtpConfig.port}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Dispatch Time:</td>
      <td style="padding: 8px 0; color: #111827;">${testDateFormatted} (WAT)</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Security:</td>
      <td style="padding: 8px 0; color: #059669; font-weight: bold;">SSL / TLS Encrypted (Port ${smtpConfig.port})</td>
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
      console.log(`[Serverless Email API] Executing real test send to ${targetRecipient}...`);
      const info = await transporter.sendMail({
        from: `"GamblePause Initiative Africa" <${smtpConfig.user}>`,
        to: targetRecipient,
        subject: testSubject,
        text: testText,
        html: testHtml,
      });

      console.log(`[Serverless Email API] Real test email accepted by SMTP server. MessageID: ${info.messageId}`);

      return res.status(200).json({
        success: true,
        stage: 'smtp_send_success',
        message: 'SMTP message accepted by SMTP transport',
        recipient: masked,
        messageId: info.messageId,
        accepted: info.accepted,
      });
    } catch (sendErr: any) {
      const mapped = mapSmtpError(sendErr);
      console.warn(`[Serverless Email API] Diagnostic SMTP sendMail notice to ${targetRecipient}:`, mapped.message);
      return res.status(500).json({
        success: false,
        stage: mapped.stage,
        error: mapped.message,
        code: mapped.code,
        recipient: masked,
      });
    }
  }

  // =========================================================================
  // 5. Client Assessment Availability & Reminder Email Mode
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
        code: 'INVALID_RECIPIENT',
      });
    }

    if (!smtpConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    // Idempotency check if notificationId provided
    const adminDb = getAdminFirestoreInstance();
    if (notificationId && adminDb) {
      try {
        const notifDoc = await adminDb.collection('notifications').doc(notificationId).get();
        if (notifDoc.exists) {
          const nData = notifDoc.data();
          if (nData && nData.emailStatus === 'sent') {
            return res.status(200).json({
              success: true,
              stage: 'idempotency',
              message: 'Email already sent for this assessment notification record.',
              alreadySent: true,
              emailSentAt: nData.emailSentAt,
              messageId: nData.emailMessageId,
            });
          }
        }
      } catch (idempErr) {
        console.warn('[Serverless Email API] Assessment idempotency check notice:', idempErr);
      }
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
    <a href="${link}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Complete Assessment Confidentially</a>
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
        from: `"GamblePause Initiative Africa" <${smtpConfig.user}>`,
        to: targetEmail,
        subject: emailSubject,
        text: emailBody,
        html: emailHtml,
      });

      console.log(`[Serverless Email API] Assessment email accepted by SMTP for ${targetEmail}. MessageID: ${info.messageId}`);

      if (notificationId && adminDb) {
        try {
          await adminDb.collection('notifications').doc(notificationId).set(
            {
              emailStatus: 'sent',
              emailSentAt: new Date().toISOString(),
              emailMessageId: info.messageId || '',
            },
            { merge: true }
          );
        } catch {}
      }

      return res.status(200).json({
        success: true,
        stage: 'dispatched',
        message: 'SMTP message accepted by SMTP transport',
        recipient: maskEmail(targetEmail),
        messageId: info.messageId,
      });
    } catch (err: any) {
      const mapped = mapSmtpError(err);
      console.error(`[Serverless Email API] Assessment email failed to ${targetEmail}:`, mapped.message);

      if (notificationId && adminDb) {
        try {
          await adminDb.collection('notifications').doc(notificationId).set(
            {
              emailStatus: 'failed',
              emailLastError: mapped.message,
              emailLastAttempt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {}
      }

      return res.status(500).json({
        success: false,
        stage: mapped.stage,
        error: mapped.message,
        code: mapped.code,
      });
    }
  }

  // =========================================================================
  // 6. Counsellor Assignment & Reassignment Notification Mode
  // =========================================================================
  if (!notificationId || !clientId || !counsellorId) {
    return res.status(400).json({
      success: false,
      stage: 'payload_validation',
      error: 'Missing required parameters: notificationId, clientId, and counsellorId are mandatory.',
      code: 'MISSING_PARAMETERS',
    });
  }

  // Check 6a: Concurrency deduplication (ephemeral)
  if (inFlightNotificationIds.has(notificationId)) {
    return res.status(200).json({
      success: true,
      stage: 'idempotency',
      message: 'Email already currently being processed for this notification.',
      alreadySent: true,
    });
  }

  // Check 6b: Firestore-backed email status verification (persistent across serverless instances)
  const adminDb = getAdminFirestoreInstance();
  if (adminDb) {
    try {
      const notifRef = adminDb.collection('notifications').doc(notificationId);
      const notifSnap = await notifRef.get();
      if (notifSnap.exists) {
        const notifData = notifSnap.data();
        if (notifData && notifData.emailStatus === 'sent') {
          inFlightNotificationIds.add(notificationId);
          return res.status(200).json({
            success: true,
            stage: 'idempotency',
            message: 'Email already sent for this notification record.',
            alreadySent: true,
            emailSentAt: notifData.emailSentAt,
            messageId: notifData.emailMessageId,
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

  const knownCounsellor = TRUSTED_COUNSELLOR_DIRECTORY[counsellorId];
  if (knownCounsellor) {
    counsellorName = knownCounsellor.name;
    counsellorEmail = knownCounsellor.email;
  }

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
    return res.status(400).json({
      success: false,
      stage: 'counsellor_resolution',
      error: `Unrecognized or unauthorized counsellor ID: "${counsellorId}". Email recipient cannot be resolved from trusted staff records.`,
      code: 'COUNSELLOR_NOT_FOUND',
    });
  }

  // 8. Confirm client assignment if Firestore is available and this is a new assignment to this counsellor
  if (adminDb && actionType !== 'reassignment_previous') {
    try {
      const clientDoc = await adminDb.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const cData = clientDoc.data();
        if (cData && cData.assignedCounsellorId && cData.assignedCounsellorId !== counsellorId) {
          return res.status(400).json({
            success: false,
            stage: 'assignment_verification',
            error: `Mismatched assignment: client ${clientId} is currently assigned to ${cData.assignedCounsellorId}, not ${counsellorId}.`,
            code: 'ASSIGNMENT_MISMATCH',
          });
        }
      }
    } catch (e) {
      console.warn('[Serverless Email API] Client verification notice:', e);
    }
  }

  // 9. Check SMTP transport configuration
  if (!smtpConfig.isConfigured) {
    return res.status(503).json({
      success: false,
      stage: 'smtp_config',
      error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
      code: 'SMTP_NOT_CONFIGURED',
    });
  }

  const transporter = createSmtpTransporter();
  if (!transporter) {
    return res.status(503).json({
      success: false,
      stage: 'smtp_config',
      error: `SMTP is not configured for this deployment. Missing required environment variable(s): ${smtpConfig.missing.join(', ')}.`,
      code: 'SMTP_NOT_CONFIGURED',
    });
  }

  inFlightNotificationIds.add(notificationId);

  // 10. Construct strictly privacy-minimal email content (NO diagnosis, scores, phone, notes, or history)
  const portalUrl = 'https://gamblepausemanagement.com/';
  let emailSubject = 'New Client Assigned — GamblePause';
  let emailHeading = 'Counsellor Caseload Notification';
  let emailText = `Hello ${counsellorName},\n\nA new client (${clientId}) has been assigned to your caseload.\n\nPlease sign in to the GamblePause Counsellor Portal to view the client and review their clinical schedule:\n\n${portalUrl}\n\nWarm regards,\nGamblePause Initiative Africa`;

  if (actionType === 'reassignment') {
    emailSubject = 'Client Reassigned to Your Caseload — GamblePause';
    emailHeading = 'Caseload Reassignment Notification';
    emailText = `Hello ${counsellorName},\n\nClient (${clientId}) has been reassigned to your caseload.\n\nPlease sign in to the GamblePause Counsellor Portal to review their active profile:\n\n${portalUrl}\n\nWarm regards,\nGamblePause Initiative Africa`;
  } else if (actionType === 'reassignment_previous') {
    emailSubject = 'Client Transferred from Caseload — GamblePause';
    emailHeading = 'Client Transfer Notice';
    emailText = `Hello ${counsellorName},\n\nPlease be advised that client (${clientId}) has been transferred from your caseload to another counsellor.\n\nWarm regards,\nGamblePause Initiative Africa`;
  }

  const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
  <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 700;">GamblePause Initiative Africa</h2>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${emailHeading}</p>
  </div>
  <p style="font-size: 15px;">Hello ${counsellorName},</p>
  ${
    actionType === 'reassignment'
      ? `<p style="font-size: 15px;">Client (<strong>${clientId}</strong>) has been reassigned to your caseload.</p>`
      : actionType === 'reassignment_previous'
      ? `<p style="font-size: 15px;">Please be advised that client (<strong>${clientId}</strong>) has been transferred from your caseload to another counsellor.</p>`
      : `<p style="font-size: 15px;">A new client (<strong>${clientId}</strong>) has been assigned to your caseload.</p>`
  }
  <p style="font-size: 15px;">Please sign in to the GamblePause Counsellor Portal to view the client and review their clinical schedule.</p>
  <div style="margin: 28px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Sign in to Counsellor Portal</a>
  </div>
  <p style="margin-top: 32px; font-size: 13px; color: #4b5563; border-top: 1px solid #f3f4f6; padding-top: 16px;">
    Warm regards,<br>
    <strong>GamblePause Initiative Africa</strong><br>
    <span style="color: #9ca3af; font-size: 12px;">This is an automated notification. Confidential client details are accessible only after authenticating into the Counsellor Portal.</span>
  </p>
</div>`;

  // 11. Dispatch email via Nodemailer
  try {
    console.log(`[Serverless Email API] Dispatching email to ${counsellorEmail} for client ${clientId}...`);
    const info = await transporter.sendMail({
      from: `"GamblePause Initiative Africa" <${smtpConfig.user}>`,
      to: counsellorEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    console.log(`[Serverless Email API] Email accepted by SMTP server for ${counsellorEmail}. MessageID: ${info.messageId}`);

    // Update Firestore notification record
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
        console.warn('[Serverless Email API] Notice updating emailStatus in Firestore:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      stage: 'dispatched',
      message: 'SMTP message accepted by SMTP transport',
      messageId: info.messageId,
      recipient: maskEmail(counsellorEmail),
    });
  } catch (sendErr: any) {
    // Release in-flight flag so it can be retried legitimately
    inFlightNotificationIds.delete(notificationId);
    const mapped = mapSmtpError(sendErr);
    console.error(`[Serverless Email API] SMTP send error to ${counsellorEmail}:`, mapped.message);

    if (adminDb) {
      try {
        await adminDb.collection('notifications').doc(notificationId).set(
          {
            emailStatus: 'failed',
            emailLastError: mapped.message,
            emailLastAttempt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    }

    return res.status(500).json({
      success: false,
      stage: mapped.stage,
      error: mapped.message,
      code: mapped.code,
      recipient: maskEmail(counsellorEmail),
    });
  }
}
