import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { auth } from "@/services/firebase/firebase-client";

export async function firebaseSignIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignUp(
  fullName: string,
  email: string,
  password: string,
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName.trim()) {
    await updateProfile(credential.user, { displayName: fullName.trim() });
  }
  return credential;
}

export async function firebaseSignOut() {
  await signOut(auth);
}

export async function firebaseSignInWithGoogle(tokens: {
  idToken?: string;
  accessToken?: string;
}) {
  if (!tokens.idToken && !tokens.accessToken) {
    throw new Error("Google sign-in token is missing.");
  }

  const credential = GoogleAuthProvider.credential(
    tokens.idToken,
    tokens.accessToken,
  );
  return signInWithCredential(auth, credential);
}

export function subscribeToAuthState(listener: (user: User | null) => void) {
  return onAuthStateChanged(auth, listener);
}
