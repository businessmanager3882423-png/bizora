import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyDh9JHJKNJ_KMRJhfgUoaLbgLK8obeNX50",
  authDomain: "bizora-f3bd3.firebaseapp.com",
  projectId: "bizora-f3bd3",
  storageBucket: "bizora-f3bd3.firebasestorage.app",
  messagingSenderId: "227436569298",
  appId: "1:227436569298:web:e6875fd25f43c483c5830b"
});

export const auth = getAuth(app);
// Offline mode: data phone mein cache hota hai aur internet aate hi sync ho jata hai
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
