// Applies dark mode immediately if set
if (localStorage.getItem('pericos_dark') === 'true') { document.body.classList.add('dark-mode'); }

function updateClockAndGreeting() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', options);

    const hour = now.getHours();
    let greeting = "Goodnight"; 
    if (hour >= 6 && hour < 12) greeting = "Good Morning";
    else if (hour >= 12 && hour < 20) greeting = "Good Afternoon";
    
    return greeting;
}

const firebaseConfig = {
    apiKey: "AIzaSyAOO73pfw9yyyukquyOJfjs2nPNQn__XLM",
    authDomain: "los-pericos-46378.firebaseapp.com",
    databaseURL: "https://los-pericos-46378-default-rtdb.firebaseio.com",
    projectId: "los-pericos-46378",
    storageBucket: "los-pericos-46378.firebasestorage.app",
    messagingSenderId: "463221124647",
    appId: "1:463221124647:web:5e54ad293b174992096802"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const messaging = firebase.messaging();

const TEAM_PINS = {
    "8096": { name: "Jorge", role: "Manager", location: "LP_Willis" },
    "0623": { name: "Luis H", role: "Manager", location: "LP_Willis" },
    "6660": { name: "Elias", role: "Manager", location: "LP_Huntsville" },
    "1116": { name: "Stephanie", role: "Owner", location: "All" },
    "0523": { name: "Luis M", role: "Owner", location: "All" }
};

let activeUser = localStorage.getItem('pericos_active_user');
let activeRole = localStorage.getItem('pericos_active_role');
let currentLocation = localStorage.getItem('pericos_location'); 

firebase.auth().onAuthStateChanged((user) => {
    if (user && activeUser) {
        showDashboard();
    } else {
        document.getElementById('dashboard-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('pin-input').focus();
    }
});

function verifyPin() {
    let pin = document.getElementById('pin-input').value;
    let userData = TEAM_PINS[pin];
    
    if (userData) {
        firebase.auth().signInAnonymously().then(() => {
            activeUser = userData.name;
            activeRole = userData.role;
            if (activeRole === 'Owner') { currentLocation = localStorage.getItem('pericos_location') || 'LP_Willis'; } 
            else { currentLocation = userData.location; }

            localStorage.setItem('pericos_active_user', activeUser);
            localStorage.setItem('pericos_active_role', activeRole);
            localStorage.setItem('pericos_location', currentLocation);
            
            document.getElementById('pin-error').style.display = 'none';
            showDashboard();
        }).catch((error) => {
            alert("⚠️ Cannot connect to Firebase Security. Check your internet connection.");
        });
    } else {
        document.getElementById('pin-error').style.display = 'block';
        document.getElementById('pin-input').value = '';
    }
}

document.getElementById("pin-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        verifyPin();
    }
});

async function setupPushNotifications() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await messaging.getToken({ vapidKey: 'BIMlErwSGg4lU5iyhlpSkw3hm3QGLq0Bqz_wihLr0CRfGz0EQyLaZfHthlORbtoUK12zquN0njp0_iTN4H_DE7w' });
            if (token) {
                db.ref(`${currentLocation}/fcmTokens/${activeUser}`).set(token);
            }
        }
    } catch (error) {
        console.error('Error setting up push notifications', error);
    }
}

messaging.onMessage((payload) => {
    alert(`📣 New Update: ${payload.notification.body}`);
});

function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'flex';
    
    let timeGreeting = updateClockAndGreeting();
    document.getElementById('display-name').innerText = `${timeGreeting}, ${activeUser.split(' ')[0]}`;
    
    let locSwitcher = document.getElementById('location-switcher');
    let ownerWidget = document.getElementById('owner-widget');
    
    if (activeRole === 'Owner') {
        document.getElementById('display-role').innerText = `${activeRole} Access`;
        locSwitcher.style.display = 'inline-block';
        locSwitcher.value = currentLocation;
        ownerWidget.style.display = 'block'; 
        loadOwnerStats(); 
    } else {
        let displayLoc = currentLocation ? currentLocation.replace('_', ' ') : '';
        document.getElementById('display-role').innerText = `${activeRole} • ${displayLoc}`;
        locSwitcher.style.display = 'none';
        ownerWidget.style.display = 'none'; 
    }

    // Show Bar Vault only for Managers or Owners
    if (activeRole === 'Manager' || activeRole === 'Owner') {
        document.getElementById('bar-vault-btn').style.display = 'flex';
    } else {
        document.getElementById('bar-vault-btn').style.display = 'none';
    }

    setupPushNotifications();

    loadDashboardAlerts();
}

function switchLocation(newLocation) {
    currentLocation = newLocation;
    localStorage.setItem('pericos_location', currentLocation);
    location.reload(); 
}

function loadOwnerStats() {
    ['LP_Willis', 'LP_Huntsville'].forEach(loc => {
        let prefix = loc === 'LP_Willis' ? 'w' : 'h';
        
        db.ref(loc + '/events').on('value', snap => {
            let count = 0;
            const today = new Date();
            today.setHours(0,0,0,0);
            
            snap.forEach(child => {
                let ev = child.val();
                if(ev.date && typeof ev.date === 'string') {
                    let parts = ev.date.split('-');
                    if(parts.length === 3) {
                        let evDate = new Date(parts[0], parts[1]-1, parts[2]);
                        let diff = Math.round((evDate - today)/(1000*60*60*24));
                        if(diff >= 0 && diff <= 7) count++;
                    }
                }
            });
            document.getElementById(prefix + '-events').innerText = count;
        });

        db.ref(loc + '/pending_delivery').on('value', snap => {
            let count = snap.numChildren(); 
            document.getElementById(prefix + '-trucks').innerText = count;
        });

        db.ref(loc + '/quick_notes').on('value', snap => {
            let count = 0;
            snap.forEach(child => {
                if(child.val().status !== 'done') count++;
            });
            document.getElementById(prefix + '-notes').innerText = count;
        });
    });
}

function loadDashboardAlerts() {
    const container = document.getElementById('alerts-container');
    
    let currentEvents = [];
    let currentNotes = [];
    let isInitialLoad = true;

    function renderBoard() {
        let html = '';
        
        const today = new Date();
        today.setHours(0,0,0,0);
        let upcomingEvents = [];

        currentEvents.forEach(ev => {
            if (!ev.date || typeof ev.date !== 'string') return; 
            let parts = ev.date.split('-');
            if (parts.length !== 3) return;

            let [y, m, d] = parts;
            let evDate = new Date(y, m - 1, d);
            let dayDiff = Math.round((evDate - today) / (1000 * 60 * 60 * 24));
            
            if (dayDiff >= 0 && dayDiff <= 7) {
                upcomingEvents.push({ ...ev, dayDiff: dayDiff, exactDate: evDate });
            }
        });

        upcomingEvents.sort((a, b) => a.dayDiff - b.dayDiff);

        upcomingEvents.forEach(ev => {
            let dayLabel = "";
            if (ev.dayDiff === 0) dayLabel = "🚨 TODAY";
            else if (ev.dayDiff === 1) dayLabel = "📅 TOMORROW";
            else dayLabel = "📅 " + ev.exactDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

            html += `<div class="alert-bubble alert-auto">
                <div>
                    <div class="alert-author">${dayLabel} AT ${ev.start || 'TBD'}</div>
                    ${ev.type || 'Event'}: ${ev.customer || 'Unknown'} (${ev.guests || '?'} Guests)
                </div>
            </div>`;
        });

        let now = Date.now();
        currentNotes.forEach(note => {
            if (!note.timestamp) return;

            let ageHours = (now - note.timestamp) / (1000 * 60 * 60);

            if (note.status === 'done' && ageHours >= 24) {
                db.ref(currentLocation + '/quick_notes/' + note.id).remove();
                return; 
            }

            let isDone = note.status === 'done';
            let extraStyle = isDone ? 'opacity: 0.55; text-decoration: line-through; background: transparent; border-color: var(--container-border); box-shadow: none;' : '';
            let actionBtn = isDone ? '<span style="font-size:12px; font-weight:800; opacity:0.6;">✔️ Done</span>' : `<button class="dismiss-btn" onclick="markQuickNoteDone('${note.id}')" title="Mark Done">✅</button>`;

            html += `<div class="alert-bubble alert-manual" style="${extraStyle}">
                <div>
                    <div class="alert-author">👤 ${note.author || 'Staff'}</div>
                    ${note.message}
                </div>
                ${actionBtn}
            </div>`;
        });

        container.innerHTML = html;
    }

    db.ref(currentLocation + '/events').on('value', snap => {
        currentEvents = [];
        snap.forEach(child => { currentEvents.push({ id: child.key, ...child.val() }); });
        renderBoard();
    });

    db.ref(currentLocation + '/quick_notes').on('value', snap => {
        currentNotes = [];
        snap.forEach(child => { currentNotes.push({ id: child.key, ...child.val() }); });
        renderBoard();
        isInitialLoad = false; 
    });

    db.ref(currentLocation + '/quick_notes').limitToLast(1).on('child_added', snap => {
        if (isInitialLoad) return; 

        let note = snap.val();
        let locName = currentLocation.replace('LP_', '');

        if (note.author !== activeUser.split(' ')[0] && note.status === 'active') {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`📌 Pericos ${locName} - Note from ${note.author}`, {
                    body: note.message,
                    icon: "image_0.png"
                });
            }
        }
    });
}

function postQuickNote() {
    const input = document.getElementById('quickNoteInput');
    const msg = input.value.trim();
    if (!msg) return;

    db.ref(currentLocation + '/quick_notes').push({
        author: activeUser.split(' ')[0],
        message: msg,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'active'
    });

    input.value = ''; 
}

function markQuickNoteDone(noteId) {
    db.ref(currentLocation + '/quick_notes/' + noteId).update({ status: 'done' });
}

function logoutUser() {
    if(confirm("Are you sure you want to securely log out of all apps?")) {
        firebase.auth().signOut().then(() => {
            localStorage.removeItem('pericos_active_user');
            localStorage.removeItem('pericos_active_role');
            location.reload(); 
        });
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('darkModeBtn').innerText = isDark ? '☀️ Light Theme' : '🌙 Dark Theme';
    localStorage.setItem('pericos_dark', isDark);
}
