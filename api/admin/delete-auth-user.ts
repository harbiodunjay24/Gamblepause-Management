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

  // 1. Verify caller is an authorized Super Admin
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing Bearer token' });
  }

  const idToken = authHeader.replace('Bearer ', '').trim();
  let callerEmail = '';
  let callerUid = '';
  let isSuperAdmin = false;

  try {
    const adminAuth = getAdminAuthInstance();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    callerEmail = (decodedToken.email || '').toLowerCase().trim();
    callerUid = decodedToken.uid;

    if (SUPER_ADMIN_EMAILS.includes(callerEmail) || decodedToken.role === 'Super Admin') {
      isSuperAdmin = true;
    } else {
      // Check caller's user record in Firestore
      const db = getAdminFirestoreInstance();
      if (db) {
        const uDoc = await db.collection('users').doc(callerUid).get();
        if (uDoc.exists && uDoc.data()?.role === 'Super Admin') {
          isSuperAdmin = true;
        }
      }
    }
  } catch (err: any) {
    console.warn('[Delete Auth User API] Token verification failed:', err?.message || err);
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
  }

  if (!isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden: Super Admin privileges required' });
  }

  const { authUid } = req.body || {};
  if (!authUid || typeof authUid !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing authUid parameter' });
  }

  // Prevent a Super Admin from accidentally deleting themselves
  if (authUid === callerUid) {
    return res.status(400).json({ success: false, error: 'Cannot delete your own active Super Admin account' });
  }

  try {
    const adminAuth = getAdminAuthInstance();
    await adminAuth.deleteUser(authUid);
    console.log(`[Delete Auth User API] Successfully deleted Firebase Auth account: ${authUid}`);
    return res.status(200).json({
      success: true,
      authDeleted: true,
      message: `Firebase Authentication account ${authUid} was permanently deleted.`,
    });
  } catch (err: any) {
    console.warn(`[Delete Auth User API] deleteUser(${authUid}) failed:`, err?.message || err);
    if (err?.code === 'auth/user-not-found') {
      return res.status(200).json({
        success: true,
        authDeleted: true,
        message: 'Account did not exist in Firebase Auth or was already deleted.',
      });
    }
    return res.status(500).json({
      success: false,
      authDeleted: false,
      error: `Firebase Admin deleteUser failed: ${err?.message || err}`,
    });
  }
}
