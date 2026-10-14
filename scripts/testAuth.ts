import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

const emails = ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'];
const passwords = ['Gamblepause', 'Gamblepause123', 'Gamblepause2025', 'GamblePause2025!', 'Gamblepause2026', 'Gamblepause@2025', 'Gamblepause@2026', 'Password123!', 'Admin12345!'];

async function run() {
  for (const email of emails) {
    for (const pw of passwords) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pw);
        console.log(`SUCCESS: ${email} with password: ${pw} (uid: ${res.user.uid})`);
        return;
      } catch (err: any) {
        // continue
      }
    }
  }
  console.log('None worked');
}

run().then(() => process.exit(0));
