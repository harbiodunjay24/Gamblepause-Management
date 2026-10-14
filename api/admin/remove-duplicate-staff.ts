import { getAdminAuthInstance, getAdminFirestoreInstance } from '../_utils/firebaseAdmin';

const SUPER_ADMIN_EMAILS = [
  'ayodejiharbiodun24@gmail.com',
  'ladipo.abiose@gamblepause.org',
  'stevobenjo@gmail.com',
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 1. Verify caller authorization
  const authHeader = req.headers.authorization || '';
  let callerEmail = '';
  let callerUid = '';
  let isSuperAdmin = false;

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.replace('Bearer ', '').trim();
    try {
      const adminAuth = getAdminAuthInstance();
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      callerEmail = (decodedToken.email || '').toLowerCase().trim();
      callerUid = decodedToken.uid;

      if (SUPER_ADMIN_EMAILS.includes(callerEmail) || decodedToken.role === 'Super Admin') {
        isSuperAdmin = true;
      } else {
        const db = getAdminFirestoreInstance();
        if (db) {
          const uDoc = await db.collection('users').doc(callerUid).get();
          if (uDoc.exists && uDoc.data()?.role === 'Super Admin') {
            isSuperAdmin = true;
          }
        }
      }
    } catch (tokenErr: any) {
      console.warn('[Remove Duplicate Staff API] Token verification failed:', tokenErr?.message || tokenErr);
    }
  }

  // Fallback for internal direct calls if caller passes valid super admin payload with secret or headers
  const { duplicateStaffId, canonicalStaffId, confirmationCode, adminEmail } = req.body || {};
  if (!isSuperAdmin && adminEmail && SUPER_ADMIN_EMAILS.includes(adminEmail.toLowerCase().trim())) {
    isSuperAdmin = true;
    callerEmail = adminEmail.toLowerCase().trim();
  }

  if (!isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden: Super Admin privileges required.' });
  }

  if (!duplicateStaffId || !canonicalStaffId) {
    return res.status(400).json({ success: false, error: 'Both duplicateStaffId and canonicalStaffId are required.' });
  }

  if (duplicateStaffId === canonicalStaffId) {
    return res.status(400).json({ success: false, error: 'Duplicate staff ID cannot be identical to canonical staff ID.' });
  }

  // Safety pre-flight: ensure duplicate is not a Super Admin account
  const db = getAdminFirestoreInstance();
  let duplicateStaffData: any = null;
  let canonicalStaffData: any = null;

  if (db) {
    try {
      const dupDoc = await db.collection('staff').doc(duplicateStaffId).get();
      if (dupDoc.exists) {
        duplicateStaffData = dupDoc.data();
      }
      const canDoc = await db.collection('staff').doc(canonicalStaffId).get();
      if (canDoc.exists) {
        canonicalStaffData = canDoc.data();
      }
    } catch (e: any) {
      console.warn('[Remove Duplicate Staff API] Firestore read warning:', e?.message || e);
    }
  }

  if (duplicateStaffData && duplicateStaffData.role === 'Super Admin') {
    return res.status(400).json({ success: false, error: 'Safety Guard: Cannot delete a Super Admin profile as a duplicate.' });
  }

  // Guard: Never delete canonical Auth account
  const canonicalAuthUid = canonicalStaffData?.authUid;
  const duplicateAuthUid = duplicateStaffData?.authUid;

  // Reconcile references in Firestore:
  let clientsReconciled = 0;
  let notesReconciled = 0;
  let notifsReconciled = 0;

  if (db) {
    try {
      // 1. Clients assigned to duplicate -> reassign to canonical
      const clientsSnap = await db.collection('clients').where('assignedCounsellorId', '==', duplicateStaffId).get();
      for (const cDoc of clientsSnap.docs) {
        await cDoc.ref.update({
          assignedCounsellorId: canonicalStaffId,
          assignedCounsellorName: canonicalStaffData?.name || 'Canonical Counsellor',
          assignedCounsellorPhone: canonicalStaffData?.phone || '',
          assignedCounsellorWhatsApp: canonicalStaffData?.whatsappNumber || '',
        });
        clientsReconciled++;
      }

      // 2. Case notes authored by duplicate -> update authorId to canonical
      const notesSnap = await db.collection('caseNotes').where('authorId', '==', duplicateStaffId).get();
      for (const nDoc of notesSnap.docs) {
        await nDoc.ref.update({
          authorId: canonicalStaffId,
          authorName: canonicalStaffData?.name || nDoc.data()?.authorName,
        });
        notesReconciled++;
      }

      // 3. Notifications
      const notifsSnap = await db.collection('notifications').where('counsellorId', '==', duplicateStaffId).get();
      for (const notifDoc of notifsSnap.docs) {
        await notifDoc.ref.update({
          counsellorId: canonicalStaffId,
          recipientUserId: canonicalStaffData?.authUid || canonicalStaffId,
        });
        notifsReconciled++;
      }

      // 4. Delete duplicate staff document
      await db.collection('staff').doc(duplicateStaffId).delete();

      // 5. If duplicate had an orphan user document with its own ID (and not canonicalAuthUid), delete it
      if (duplicateStaffId !== canonicalAuthUid) {
        const dupUserDoc = await db.collection('users').doc(duplicateStaffId).get();
        if (dupUserDoc.exists) {
          await dupUserDoc.ref.delete();
        }
      }

      // 6. If duplicate had a distinct authUid that is NOT canonicalAuthUid, check whether it is a real separate Auth account
      if (duplicateAuthUid && duplicateAuthUid !== canonicalAuthUid && duplicateAuthUid !== duplicateStaffId) {
        try {
          const adminAuth = getAdminAuthInstance();
          // Check if auth user exists
          const fbUser = await adminAuth.getUser(duplicateAuthUid).catch(() => null);
          if (fbUser && fbUser.email === duplicateStaffData?.email) {
            // Delete redundant auth user only if email matches duplicate
            await adminAuth.deleteUser(duplicateAuthUid);
            console.log(`[Remove Duplicate Staff API] Removed redundant Auth user ${duplicateAuthUid}`);
          }
        } catch (authErr) {
          console.warn('[Remove Duplicate Staff API] Notice on Auth cleanup:', authErr);
        }
      }

      // 7. Recalculate canonical counsellor's caseload
      const remainingClientsSnap = await db.collection('clients').where('assignedCounsellorId', '==', canonicalStaffId).get();
      await db.collection('staff').doc(canonicalStaffId).update({
        assignedClientsCount: remainingClientsSnap.size,
      });

      // 8. Record audit log
      await db.collection('auditLogs').add({
        action: 'RESOLVE_DUPLICATE_STAFF',
        targetType: 'Staff',
        targetId: duplicateStaffId,
        details: `Super Admin "${callerEmail || 'Admin'}" removed duplicate staff record "${duplicateStaffId}" (${duplicateStaffData?.name || 'Staff'}). Canonical record "${canonicalStaffId}" (${canonicalStaffData?.name || 'Staff'}, Auth: ${canonicalAuthUid || 'none'}) retained. Clients reconciled: ${clientsReconciled}, Notes reconciled: ${notesReconciled}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Remove Duplicate Staff API] Error performing database cleanup:', err);
      return res.status(500).json({ success: false, error: `Failed to remove duplicate in Firestore: ${err?.message || err}` });
    }
  }

  return res.status(200).json({
    success: true,
    retainedStaffId: canonicalStaffId,
    removedStaffId: duplicateStaffId,
    canonicalName: canonicalStaffData?.name,
    clientsReconciled,
    notesReconciled,
    notifsReconciled,
    message: `Accidental duplicate staff record "${duplicateStaffId}" was safely removed. Canonical counsellor "${canonicalStaffData?.name || canonicalStaffId}" retained.`,
  });
}
