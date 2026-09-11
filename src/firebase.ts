/**
 * firebase.ts — compatibility shim
 *
 * All components import from this file exactly as before.
 * We redirect every export to the Supabase-backed equivalents
 * so no component file needs to change.
 */

// ── Firestore API ────────────────────────────────────────────────────────────
export {
  db,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
} from './lib/firestoreShim';

// ── Auth API ─────────────────────────────────────────────────────────────────
export {
  auth,
  signIn,
  logOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
} from './lib/supabaseAuth';
