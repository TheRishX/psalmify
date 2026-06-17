import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBoRxsZN4O6lgqUQkfrDK-QgoNQCQEYpV4",
  authDomain: "gen-lang-client-0356842658.firebaseapp.com",
  projectId: "gen-lang-client-0356842658",
  storageBucket: "gen-lang-client-0356842658.firebasestorage.app",
  messagingSenderId: "85354516880",
  appId: "1:85354516880:web:c437a0b9e1d2404b09a315"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication & Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// IMPORTANT: Specify the exact databaseId provisioned by AI Studio
export const db = getFirestore(app, "ai-studio-8b498bed-f800-4212-b0ee-2203e6f8508a");
