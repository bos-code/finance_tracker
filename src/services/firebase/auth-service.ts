import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "@/services/firebase/firebase-client";

export async function firebaseSignIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignOut() {
  await signOut(auth);
}
