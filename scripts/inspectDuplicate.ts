import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function inspect() {
  await signInWithEmailAndPassword(auth, 'ladipo.abiose@gamblepause.org', 'Gamblepause');
  console.log('Authenticated as Super Admin');

  const idA = 'counsellor-1791797996969';
  const idB = 'counsellor-1791798002935';

  const collections = ['clients', 'caseNotes', 'assessments', 'notifications', 'auditLogs', 'users', 'staff'];
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log('Collection: ' + colName + ' (total docs: ' + snap.size + ')');
      snap.forEach(d => {
        const str = JSON.stringify(d.data());
        if (str.includes(idA)) {
          console.log('  Found ref to ' + idA + ' in doc ' + d.id);
        }
        if (str.includes(idB)) {
          console.log('  Found ref to ' + idB + ' in doc ' + d.id);
        }
      });
    } catch (e: any) {
      console.log('Could not read ' + colName + ': ' + e.message);
    }
  }
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
