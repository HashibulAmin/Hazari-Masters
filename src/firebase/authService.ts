import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { handleFirestoreError, OperationType } from './errors';

export interface UserProfile {
  uid: string;
  email: string | null;
  username: string;
  displayName: string;
  role: 'admin' | 'player';
  isGuest: boolean;
  totalWins: number;
  totalGamesPlayed: number;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_EMAIL = 'hasibul.amin.hemel@gmail.com';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export async function createOrUpdateUserProfile(
  user: FirebaseUser,
  customUsername?: string,
  isGuest: boolean = false
): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const isAdmin = user.email === ADMIN_EMAIL;

  let existingProfile: UserProfile | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingProfile = snap.data() as UserProfile;
    }
  } catch {}

  const username =
    customUsername ||
    existingProfile?.username ||
    user.displayName ||
    (isGuest ? `Guest_${user.uid.slice(0, 6)}` : user.email?.split('@')[0] || `Player_${user.uid.slice(0, 6)}`);

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || null,
    username,
    displayName: user.displayName || username,
    role: isAdmin ? 'admin' : (existingProfile?.role || 'player'),
    isGuest,
    totalWins: existingProfile?.totalWins || 0,
    totalGamesPlayed: existingProfile?.totalGamesPlayed || 0,
    createdAt: existingProfile?.createdAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(userRef, profile, { merge: true });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function signUpWithEmail(email: string, password: string, username: string): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  return createOrUpdateUserProfile(cred.user, username, false);
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  let profile = await getUserProfile(cred.user.uid);
  if (!profile) {
    profile = await createOrUpdateUserProfile(cred.user);
  }
  return profile;
}

export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  let profile = await getUserProfile(cred.user.uid);
  if (!profile) {
    profile = await createOrUpdateUserProfile(cred.user);
  }
  return profile;
}

export async function playAsGuest(): Promise<UserProfile> {
  const cred = await signInAnonymously(auth);
  const guestName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  await updateProfile(cred.user, { displayName: guestName });
  return createOrUpdateUserProfile(cred.user, guestName, true);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
