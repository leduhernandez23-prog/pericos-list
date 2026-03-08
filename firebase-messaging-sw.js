importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAOO73pfw9yyyukquyOJfjs2nPNQn__XLM",
    authDomain: "los-pericos-46378.firebaseapp.com",
    databaseURL: "https://los-pericos-46378-default-rtdb.firebaseio.com",
    projectId: "los-pericos-46378",
    storageBucket: "los-pericos-46378.firebasestorage.app",
    messagingSenderId: "463221124647", // Your Sender ID
    appId: "1:463221124647:web:5e54ad293b174992096802" // Your App ID
});

const messaging = firebase.messaging();

// This catches notifications when the app is in the background
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/image_0.png' // Ensure this path matches your logo
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
