/**
 * PrepTrack - Frontend Logic
 * Includes Weighted Average Calculation, Cloud Sync & System Bar UI
 */

const currentLocation = localStorage.getItem('pericos_location') || 'LP_Willis';
const activeUser = localStorage.getItem('pericos_active_user') || 'User';

// Populate System Bar
document.getElementById('loc-display').innerText = currentLocation.replace('LP_', '');
document.getElementById('user-display').innerText = activeUser;

// --- 1. Firebase Integration ---
const firebaseConfig = {
    apiKey: "AIzaSyAOO73pfw9yyyukquyOJfjs2nPNQn__XLM",
    authDomain: "los-pericos-46378.firebaseapp.com",
    databaseURL: "https://los-pericos-46378-default-rtdb.firebaseio.com",
    projectId: "los-pericos-46378",
    storageBucket: "los-pericos-46378.firebasestorage.app",
    messagingSenderId: "463221124647",
    appId: "1:463221124647:web:5e54ad293b174992096802"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let inventoryData = [];
let totalWasteValue = 0;

const suppliers = [
    { name: 'FreshFarms Produce', phone: '555-0192', items: 'Produce' },
    { name: 'Valley Dairy Co.', phone: '555-0344', items: 'Dairy' },
    { name: 'Sysco / US Foods', phone: '555-0911', items: 'Dry Goods' }
];

// --- 2. DOM Elements ---
const inventoryBody = document.getElementById('inventory-body');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const wasteItemSelect = document.getElementById('waste-item');
const supplierListEl = document.getElementById('supplier-list');
const searchInput = document.getElementById('search-input');
const wasteForm = document.getElementById('waste-form');
const wasteValueEl = document.getElementById('waste-value');

const deliveryModal = document.getElementById('delivery-modal');
const btnReceiveDelivery = document.getElementById('btn-receive-delivery');
const closeDeliveryBtn = document.getElementById('close-delivery');
const deliveryForm = document.getElementById('delivery-form');
const existingItemsDatalist = document.getElementById('existing-items');

// --- 3. Cloud Sync & UI Indicator ---

function flashSync() {
    const dot = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');
    text.innerText = "Syncing...";
    dot.style.background = "#f59e0b"; // Orange
    dot.style.boxShadow = "0 0 5px #f59e0b";
    
    setTimeout(() => {
        text.innerText = "Cloud Synced";
        dot.style.background = "#10b981"; // Green
        dot.style.boxShadow = "0 0 5px #10b981";
    }, 800);
}

firebase.auth().onAuthStateChanged((user) => {
    if (user && activeUser) {
        document.getElementById('sync-text').innerText = "Connected";
        document.getElementById('sync-indicator').style.background = "#10b981";
        document.getElementById('sync-indicator').style.boxShadow = "0 0 5px #10b981";
        loadFirebaseData();
    } else {
        window.location.href = 'index.html';
    }
});

function loadFirebaseData() {
    db.ref(currentLocation + '/food_inventory').on('value', snap => {
        const data = snap.val() || {};
        inventoryData = Object.values(data);
        renderInventory(inventoryData);
        populateDropdowns();
    });

    db.ref(currentLocation + '/food_waste_total').on('value', snap => {
        totalWasteValue = snap.val() || 0;
        wasteValueEl.textContent = `$${totalWasteValue.toFixed(2)}`;
    });
}

function saveToFirebase() {
    const dataObj = {};
    inventoryData.forEach(item => { dataObj[item.id] = item; });
    db.ref(currentLocation + '/food_inventory').set(dataObj).then(() => flashSync());
}

// --- 4. Core Functions ---

function renderInventory(data) {
    inventoryBody.innerHTML = '';
    let totalInvValue = 0;
    let lowStockCount = 0;

    data.forEach(item => {
        const totalCost = item.qty * item.cost;
        totalInvValue += totalCost;

        const isLowStock = item.qty <= item.threshold;
        if (isLowStock) lowStockCount++;
        
        const statusBadge = isLowStock 
            ? `<span class="badge badge-alert">Low Stock</span>` 
            : `<span class="badge badge-safe">Optimal</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td>${item.qty.toFixed(2)} ${item.unit}</td>
            <td>$${item.cost.toFixed(2)}</td>
            <td>$${totalCost.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="updateStock(${item.id}, -1)">Use 1</button>
            </td>
        `;
        inventoryBody.appendChild(row);
    });

    totalValueEl.textContent = `$${totalInvValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    lowStockCountEl.textContent = lowStockCount;
}

function populateDropdowns() {
    wasteItemSelect.innerHTML = '<option value="" disabled selected>Select an item...</option>';
    existingItemsDatalist.innerHTML = '';

    inventoryData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.unit})`;
        wasteItemSelect.appendChild(option);

        const dataOption = document.createElement('option');
        dataOption.value = item.name;
        existingItemsDatalist.appendChild(dataOption);
    });
}

function renderSuppliers() {
    supplierListEl.innerHTML = '';
    suppliers.forEach(supplier => {
        const li = document.createElement('li');
        li.className = 'supplier-item';
        li.innerHTML = `
            <div class="supplier-info">
                <h4>${supplier.name}</h4>
                <p>Provides: ${supplier.items}</p>
            </div>
            <a href="tel:${supplier.phone}" class="btn btn-secondary" style="text-decoration: none; font-size: 0.8rem;">Call</a>
        `;
        supplierListEl.appendChild(li);
    });
}

// --- 5. Interactions & Event Listeners ---

window.updateStock = function(id, change) {
    const item = inventoryData.find(i => i.id === id);
    if (item && item.qty > 0) {
        item.qty += change;
        if (item.qty < 0) item.qty = 0; 
        saveToFirebase(); 
    }
};

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filteredData = inventoryData.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.category.toLowerCase().includes(term)
    );
    renderInventory(filteredData);
});

btnReceiveDelivery.addEventListener('click', () => {
    deliveryModal.classList.add('active-modal');
});

closeDeliveryBtn.addEventListener('click', () => {
    deliveryModal.classList.remove('active-modal');
});

window.addEventListener('click', (e) => {
    if (e.target === deliveryModal) {
        deliveryModal.classList.remove('active-modal');
    }
});

deliveryForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('del-name').value.trim();
    const catInput = document.getElementById('del-category').value;
    const qtyInput = parseFloat(document.getElementById('del-qty').value);
    const unitInput = document.getElementById('del-unit').value.trim();
    const costInput = parseFloat(document.getElementById('del-cost').value);
    const thresholdInput = parseInt(document.getElementById('del-threshold').value);

    const existingItem = inventoryData.find(i => i.name.toLowerCase() === nameInput.toLowerCase());

    if (existingItem) {
        const currentTotalValue = existingItem.qty * existingItem.cost;
        const newDeliveryValue = qtyInput * costInput;
        const newTotalQty = existingItem.qty + qtyInput;
        
        const weightedAverageCost = (currentTotalValue + newDeliveryValue) / newTotalQty;

        existingItem.qty = newTotalQty;
        existingItem.cost = weightedAverageCost; 
        existingItem.threshold = thresholdInput;
        existingItem.category = catInput;
        existingItem.unit = unitInput;
        
    } else {
        const newId = inventoryData.length > 0 ? Math.max(...inventoryData.map(i => i.id)) + 1 : 1;
        inventoryData.push({
            id: newId,
            name: nameInput,
            category: catInput,
            qty: qtyInput,
            unit: unitInput,
            cost: costInput,
            threshold: thresholdInput
        });
    }

    saveToFirebase(); 
    deliveryForm.reset();
    deliveryModal.classList.remove('active-modal');
});

wasteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const itemId = parseInt(wasteItemSelect.value);
    const wasteQty = parseFloat(document.getElementById('waste-qty').value);
    const item = inventoryData.find(i => i.id === itemId);
    
    if (item && item.qty >= wasteQty) {
        item.qty -= wasteQty;
        totalWasteValue += (wasteQty * item.cost);
        
        saveToFirebase();
        db.ref(currentLocation + '/food_waste_total').set(totalWasteValue).then(() => flashSync());
        
        wasteForm.reset();
    } else {
        alert("Cannot log more waste than current stock quantity.");
    }
});

// --- 6. Tab Navigation Logic ---
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const topHeaderTitle = document.querySelector('.top-header h1');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); 
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active-tab'));
        const targetId = item.getAttribute('href').substring(1); 
        document.getElementById(targetId).classList.add('active-tab');
        topHeaderTitle.textContent = item.textContent;
    });
});

// --- 7. Initialization ---
function initApp() {
    renderSuppliers();
}

initApp();
