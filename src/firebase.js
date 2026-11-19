import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// Keep the session after closing the browser or the installed iPhone app.
export const enablePersistentSession = () => setPersistence(auth, browserLocalPersistence);
export const observeAuth = (callback) => onAuthStateChanged(auth, callback);
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);

const plannerRef = (uid) => doc(db, 'users', uid, 'private', 'planner');

export const observePlanner = (uid, callback) => onSnapshot(plannerRef(uid), (snapshot) => callback(snapshot.exists() ? snapshot.data().planner : null));
export const savePlanner = (uid, planner) => setDoc(plannerRef(uid), { planner, updatedAt: serverTimestamp() });
