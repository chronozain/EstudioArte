// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Tu configuración de bd.txt [cite: 2]
const firebaseConfig = {
    apiKey: "AIzaSyCdNroefbfgKJcKT5nR6UAcx1mckosqRM4",
    authDomain: "bd-personal-c3e4d.firebaseapp.com",
    projectId: "bd-personal-c3e4d",
    storageBucket: "bd-personal-c3e4d.firebasestorage.app",
    messagingSenderId: "739560517872",
    appId: "1:739560517872:web:8df36c57591b3220985235"
};

// Inicializar Firebase [cite: 3]
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, addDoc, getDocs, updateDoc, doc, query, where, signInWithEmailAndPassword, onAuthStateChanged, signOut };