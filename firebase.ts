import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";
import "firebase/compat/analytics"; // Changed from modular import to side-effect compat import
import { FIREBASE_CONFIG } from "./constants";

// Initialize using compat to support auth namespace
const app = firebase.initializeApp(FIREBASE_CONFIG);

export const auth = app.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = app.analytics(); // Changed to compat method call