import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTt9vzmozZ3g-wIZQ6yyEzrQiortqB5Ok",
  authDomain: "mundial-f212c.firebaseapp.com",
  projectId: "mundial-f212c",
  storageBucket: "mundial-f212c.firebasestorage.app",
  messagingSenderId: "21239770145",
  appId: "1:21239770145:web:10923119c42684757c8760",
  measurementId: "G-HVXBWD6RP5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
