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
 * Creates Nodemailer transporter using Gmail SMTP / configured SMTP environment variables
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
 * Vercel Serverless Function Handler
 * POST /api/notifications/send-counsellor-email
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
  const { notificationId, clientId, counsellorId, isTest } = body;

  // 4. Safe Transport Verification Mode (Restricted strictly to Super Admin)
  if (isTest === true) {
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(callerEmail);
    if (!isSuperAdmin) {
      console.warn(`[Serverless Email API] Diagnostic test rejected: Caller ${callerEmail || callerUid} is not a Super Admin.`);
      return res.status(403).json({
        success: false,
        stage: 'authorization',
        error: 'Forbidden: SMTP transport verification is restricted to Super Admin accounts.',
      });
    }

    console.log('[Serverless Email API] Running diagnostic SMTP transport verification...');
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn('[Serverless Email API] Diagnostic test result: SMTP credentials not configured (missing SMTP_USER/SMTP_PASSWORD).');
      return res.status(503).json({
        success: false,
        stage: 'smtp_config',
        error: 'SMTP transport is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables in Vercel.',
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    try {
      await transporter.verify();
      console.log('[Serverless Email API] Diagnostic test result: SMTP connection to Gmail verified successfully.');
      return res.status(200).json({
        success: true,
        stage: 'smtp_verified',
        message: 'SMTP transport connection verified successfully with Gmail servers.',
      });
    } catch (verifyErr: any) {
      console.error('[Serverless Email API] Diagnostic test result: SMTP connection failed:', verifyErr?.message || verifyErr);
      return res.status(500).json({
        success: false,
        stage: 'smtp_connection',
        error: `SMTP transport verification failed: ${verifyErr?.message || verifyErr}`,
      });
    }
  }

  // 5. Validate required payload parameters
  if (!notificationId || !clientId || !counsellorId) {
    console.warn('[Serverless Email API] Payload validation failed: missing notificationId, clientId, or counsellorId.');
    return res.status(400).json({
      success: false,
      stage: 'payload_validation',
      error: 'Missing required parameters: notificationId, clientId, and counsellorId are mandatory.',
    });
  }

  console.log(`[Serverless Email API] Processing email dispatch for client: ${clientId}, counsellor: ${counsellorId}, notif: ${notificationId}`);

  // 6. Check duplicate email protection (Idempotency)
  // Check 6a: In-memory concurrency deduplication
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

  // 8. Confirm client assignment if Firestore is available
  if (adminDb) {
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
  const emailSubject = 'New Client Assigned — GamblePause';
  const emailText = `Hello ${counsellorName},

A new client (${clientId}) has been assigned to your caseload.

Please sign in to the GamblePause Counsellor Portal to view the client and review their clinical schedule.

Warm regards,
GamblePause Initiative Africa`;

  const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
  <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 700;">GamblePause Initiative Africa</h2>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Counsellor Caseload Notification</p>
  </div>
  <p style="font-size: 15px;">Hello ${counsellorName},</p>
  <p style="font-size: 15px;">A new client (<strong>${clientId}</strong>) has been assigned to your caseload.</p>
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

  // 11. Dispatch email
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
    });
  } catch (sendErr: any) {
    // Release in-flight flag so it can be retried
    sentOrInFlightNotificationIds.delete(notificationId);
    console.error(`[Serverless Email API] SMTP send error to ${counsellorEmail}:`, sendErr?.message || sendErr);

    if (adminDb) {
      try {
        await adminDb.collection('notifications').doc(notificationId).set(
          {
            emailStatus: 'failed',
            emailLastError: sendErr?.message || 'SMTP delivery failure',
            emailLastAttempt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    }

    return res.status(500).json({
      success: false,
      stage: 'smtp_send',
      error: `Failed to dispatch email via SMTP: ${sendErr?.message || sendErr}`,
    });
  }
}
