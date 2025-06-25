// firebase-config.js
var firebaseConfig = {
    apiKey: "AIzaSyArwhLg0mgUW2JC5gcaaO_HGZ4tdtU5ohM",
    authDomain: "piggychores.firebaseapp.com",
    projectId: "piggychores",
    storageBucket: "piggychores.appspot.com",  // ← small fix here
    messagingSenderId: "1037106239382",
    appId: "1:1037106239382:web:c465f604a07efc051a6fb7",
    measurementId: "G-BWMPL44L8Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
