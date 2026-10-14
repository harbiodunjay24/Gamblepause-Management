import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC8z5JT7n7TeVJFKBEn2AIw4Ef8D4WfAUI',
  authDomain: 'gamblepause-africa.firebaseapp.com',
  projectId: 'gamblepause-africa',
  storageBucket: 'gamblepause-africa.firebasestorage.app',
  messagingSenderId: '375685558117',
  appId: '1:375685558117:web:21262d142144bb0cb5dbb0'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'ladipo.abiose@gamblepause.org', 'Gamblepause');

  const docA = await getDoc(doc(db, 'staff', 'counsellor-1791797996969'));
  console.log('staff/counsellor-1791797996969 exists?:', docA.exists());
  if (docA.exists()) {
    console.log('Record A data:', JSON.stringify(docA.data(), null, 2));
  }

  const docB = await getDoc(doc(db, 'staff', 'counsellor-1791798002935'));
  console.log('staff/counsellor-1791798002935 exists?:', docB.exists());
  if (docB.exists()) {
    console.log('Record B data:', JSON.stringify(docB.data(), null, 2));
  }

  const auditLogDoc = await getDoc(doc(db, 'auditLogs', '9Fng5DsxG2kxlC4HJBHp'));
  if (auditLogDoc.exists()) {
    console.log('auditLogs/9Fng5DsxG2kxlC4HJBHp data:', JSON.stringify(auditLogDoc.data(), null, 2));
  }

  // Check all staff docs
  const staffSnap = await getDocs(collection(db, 'staff'));
  console.log('\n--- All staff doc IDs ---');
  staffSnap.forEach(d => {
    const data = d.data();
    console.log(d.id, data.name, data.email, data.authUid || 'no-authUid');
  });

  // Check client GP-0369
  const clientDoc = await getDoc(doc(db, 'clients', 'GP-0369'));
  if (clientDoc.exists()) {
    console.log('\nClient GP-0369 counsellor info:', {
      assignedCounsellorId: clientDoc.data().assignedCounsellorId,
      assignedCounsellor: clientDoc.data().assignedCounsellor,
    });
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
