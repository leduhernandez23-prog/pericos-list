/**
 * PrepTrack - Frontend Logic
 * Includes Weighted Average Calculation, Food History Snapshots, Prep Builder & Cloud Suppliers
 */

const currentLocation = localStorage.getItem('pericos_location') || 'LP_Willis';
const activeUser = localStorage.getItem('pericos_active_user') || 'User';

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
let globalSuppliers = {};
let globalPrepRecipes = {};
let historyDataCache = {};

// --- 2. Cloud Sync & UI Indicator ---
function flashSync() {
    const dot = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');
    text.innerText = "Syncing...";
    dot.style.background = "#f59e0b";
    dot.style.boxShadow = "0 0 5px #f59e0b";
    setTimeout(() => {
        text.innerText = "Cloud Synced";
        dot.style.background = "#10b981";
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
    // Live Inventory
    db.ref(currentLocation + '/food_inventory').on('value', snap => {
        const data = snap.val() || {};
        inventoryData = Object.values(data);
        renderInventory(inventoryData);
        populateDropdowns();
    });

    // Waste
    db.ref(currentLocation + '/food_waste_total').on('value', snap => {
        totalWasteValue = snap.val() || 0;
        document.getElementById('waste-value').textContent = `$${totalWasteValue.toFixed(2)}`;
    });

    // Cloud Suppliers
    db.ref(currentLocation + '/food_suppliers').on('value', snap => {
        globalSuppliers = snap.val() || {};
        renderSuppliers();
    });

    // Prep Recipes
    db.ref(currentLocation + '/food_prep_recipes').on('value', snap => {
        globalPrepRecipes = snap.val() || {};
        renderPrepVault();
    });
}

function saveToFirebase() {
    const dataObj = {};
    inventoryData.forEach(item => { dataObj[item.id] = item; });
    db.ref(currentLocation + '/food_inventory').set(dataObj).then(() => flashSync());
}

// --- 3. Core Inventory Functions ---
function renderInventory(data) {
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = '';
    let totalInvValue = 0; let lowStockCount = 0;

    data.forEach(item => {
        const totalCost = item.qty * item.cost;
        totalInvValue += totalCost;
        const isLowStock = item.qty <= item.threshold;
        if (isLowStock) lowStockCount++;
        
        const statusBadge = isLowStock ? `<span class="badge badge-alert">Low Stock</span>` : `<span class="badge badge-safe">Optimal</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td>
                <input type="number" class="clean-input" value="${item.qty.toFixed(2)}" step="0.1" style="width:80px;" onchange="updateExactStock(${item.id}, this.value)"> ${item.unit}
            </td>
            <td>$${item.cost.toFixed(2)}</td>
            <td>$${totalCost.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="updateStock(${item.id}, -1)">-1</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('total-value').textContent = `$${totalInvValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('low-stock-count').textContent = lowStockCount;
}

window.updateExactStock = function(id, newQty) {
    const item = inventoryData.find(i => i.id === id);
    if (item) {
        item.qty = parseFloat(newQty) || 0;
        saveToFirebase();
    }
}

window.updateStock = function(id, change) {
    const item = inventoryData.find(i => i.id === id);
    if (item && item.qty > 0) {
        item.qty = Math.max(0, item.qty + change);
        saveToFirebase(); 
    }
};

function populateDropdowns() {
    const wasteSelect = document.getElementById('waste-item');
    const datalist = document.getElementById('existing-items');
    wasteSelect.innerHTML = '<option value="" disabled selected>Select an item...</option>';
    datalist.innerHTML = '';

    inventoryData.forEach(item => {
        const wOpt = document.createElement('option'); wOpt.value = item.id; wOpt.textContent = `${item.name} (${item.unit})`;
        wasteSelect.appendChild(wOpt);
        
        const dOpt = document.createElement('option'); dOpt.value = item.name;
        datalist.appendChild(dOpt);
    });
}

// --- 4. Delivery & Weighted Average ---
document.getElementById('btn-receive-delivery').addEventListener('click', () => { document.getElementById('delivery-modal').style.display = 'flex'; });
document.getElementById('close-delivery').addEventListener('click', () => { document.getElementById('delivery-modal').style.display = 'none'; });

document.getElementById('delivery-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('del-name').value.trim();
    const cat = document.getElementById('del-category').value;
    const qty = parseFloat(document.getElementById('del-qty').value);
    const unit = document.getElementById('del-unit').value.trim();
    const cost = parseFloat(document.getElementById('del-cost').value);
    const threshold = parseInt(document.getElementById('del-threshold').value);

    const existingItem = inventoryData.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (existingItem) {
        const currentTotalValue = existingItem.qty * existingItem.cost;
        const newDeliveryValue = qty * cost; // Assume user enters unit cost. If it's invoice total, change to just `cost`
        const newTotalQty = existingItem.qty + qty;
        
        existingItem.cost = (currentTotalValue + newDeliveryValue) / newTotalQty;
        existingItem.qty = newTotalQty;
        existingItem.receivedQty = (existingItem.receivedQty || 0) + qty; // Track for weekly snapshot
        existingItem.threshold = threshold;
        
    } else {
        const newId = inventoryData.length > 0 ? Math.max(...inventoryData.map(i => i.id)) + 1 : 1;
        inventoryData.push({
            id: newId, name: name, category: cat, qty: qty, unit: unit, cost: cost, threshold: threshold,
            startQty: 0, receivedQty: qty
        });
    }

    saveToFirebase(); 
    document.getElementById('delivery-form').reset();
    document.getElementById('delivery-modal').style.display = 'none';
});

// --- 5. Weekly Snapshots & History Vault ---
window.closeWeek = function() {
    if(!confirm("Are you sure you want to close the week? This will lock in your usage costs.")) return;

    const today = new Date().toISOString().split('T')[0];
    const snapshot = { date: today, totalCost: 0, items: [] };

    inventoryData.forEach(item => {
        const start = item.startQty || 0;
        const rec = item.receivedQty || 0;
        const used = (start + rec) - item.qty;

        if (used > 0) {
            const lineCost = used * item.cost;
            snapshot.totalCost += lineCost;
            snapshot.items.push({ name: item.name, used: used, cost: lineCost, unit: item.unit });
        }

        // Reset tracking for the new week
        item.startQty = item.qty;
        item.receivedQty = 0;
    });

    db.ref(currentLocation + '/food_history/' + today).set(snapshot).then(() => {
        saveToFirebase(); // Save the reset start/rec quantities
        alert("Week closed out successfully. View data in the History Vault.");
    });
}

window.openHistoryModal = function() {
    const select = document.getElementById('history-date-select');
    select.innerHTML = '<option value="">Loading past weeks...</option>';
    document.getElementById('history-details-container').style.display = 'none';
    document.getElementById('history-modal').style.display = 'flex';

    db.ref(currentLocation + '/food_history').once('value', snap => {
        historyDataCache = snap.val() || {};
        select.innerHTML = '<option value="">Select a past week...</option>';
        if (Object.keys(historyDataCache).length > 0) {
            Object.keys(historyDataCache).sort((a,b)=>b.localeCompare(a)).forEach(date => {
                const opt = document.createElement('option'); opt.value = date; opt.innerText = "Week Ending: " + date;
                select.appendChild(opt);
            });
        } else { select.innerHTML = '<option value="">No history saved yet.</option>'; }
    });
}

window.loadHistoryDetails = function() {
    const date = document.getElementById('history-date-select').value;
    const container = document.getElementById('history-details-container');
    const list = document.getElementById('history-item-list');
    
    if (!date || !historyDataCache[date]) { container.style.display = 'none'; return; }

    const data = historyDataCache[date];
    document.getElementById('history-total-cost').innerText = `$${(data.totalCost || 0).toFixed(2)}`;
    list.innerHTML = '';

    if (data.items) {
        data.items.forEach(item => {
            const li = document.createElement('li'); 
            li.style.padding = '10px 0'; li.style.borderBottom = '1px solid #27272a';
            li.innerHTML = `<span style="color: #3b82f6; font-weight: 500;">${item.name}:</span> Used ${item.used.toFixed(2)} ${item.unit} <span style="float: right; color: #10b981;">+$${item.cost.toFixed(2)}</span>`;
            list.appendChild(li);
        });
    }
    container.style.display = 'block';
}

window.closeHistoryModal = function() { document.getElementById('history-modal').style.display = 'none'; }

// --- 6. Kitchen Prep Vault ---
window.openPrepBuilder = function(id = null) {
    document.getElementById('prep-name').value = '';
    document.getElementById('prep-yield').value = '1';
    document.getElementById('prep-ingredients').innerHTML = '';
    document.getElementById('prep-modal').style.display = 'flex';
    addPrepIngredientRow();
}
window.closePrepBuilder = function() { document.getElementById('prep-modal').style.display = 'none'; }

window.addPrepIngredientRow = function() {
    const container = document.getElementById('prep-ingredients');
    const div = document.createElement('div');
    div.className = 'prep-row';
    div.style.display = 'grid'; div.style.gridTemplateColumns = '2fr 1fr 1fr auto'; div.style.gap = '10px'; div.style.marginBottom = '10px';
    
    let optHtml = '<option value="">Select Item...</option>';
    inventoryData.forEach(i => { optHtml += `<option value="${i.id}" data-cost="${i.cost}">${i.name} ($${i.cost.toFixed(2)}/${i.unit})</option>`; });

    div.innerHTML = `
        <select class="p-item clean-input" onchange="calcPrepTotals()">${optHtml}</select>
        <input type="number" class="p-qty clean-input" placeholder="Qty" step="0.1" oninput="calcPrepTotals()">
        <div class="p-line-cost" style="display:flex; align-items:center; color:#a1a1aa;">$0.00</div>
        <button class="btn-remove" onclick="this.parentElement.remove(); calcPrepTotals()">×</button>
    `;
    container.appendChild(div);
}

window.calcPrepTotals = function() {
    let total = 0;
    document.querySelectorAll('.prep-row').forEach(row => {
        const select = row.querySelector('.p-item');
        const qty = parseFloat(row.querySelector('.p-qty').value) || 0;
        let lineCost = 0;
        if(select.value) {
            const costPerUnit = parseFloat(select.options[select.selectedIndex].getAttribute('data-cost')) || 0;
            lineCost = costPerUnit * qty;
            total += lineCost;
        }
        row.querySelector('.p-line-cost').innerText = `$${lineCost.toFixed(2)}`;
    });
    
    const yieldAmt = parseFloat(document.getElementById('prep-yield').value) || 1;
    document.getElementById('prep-total-cost').innerText = `$${total.toFixed(2)}`;
    document.getElementById('prep-yield-cost').innerText = `$${(total / yieldAmt).toFixed(2)}`;
}

window.savePrepRecipe = function() {
    const name = document.getElementById('prep-name').value.trim();
    const yieldAmt = parseFloat(document.getElementById('prep-yield').value) || 1;
    if(!name) { alert("Please name your batch"); return; }

    const ingredients = []; let totalCost = 0;
    document.querySelectorAll('.prep-row').forEach(row => {
        const select = row.querySelector('.p-item');
        const qty = parseFloat(row.querySelector('.p-qty').value) || 0;
        if(select.value && qty > 0) {
            const itemName = select.options[select.selectedIndex].text.split(' (')[0];
            const cost = parseFloat(select.options[select.selectedIndex].getAttribute('data-cost')) * qty;
            totalCost += cost;
            ingredients.push({ id: select.value, name: itemName, qty: qty, cost: cost });
        }
    });

    const data = { name, yield: yieldAmt, totalCost, ingredients };
    db.ref(currentLocation + '/food_prep_recipes').push(data).then(() => {
        flashSync(); closePrepBuilder();
    });
}

function renderPrepVault() {
    const container = document.getElementById('prep-vault-container');
    container.innerHTML = '';
    Object.keys(globalPrepRecipes).forEach(key => {
        const recipe = globalPrepRecipes[key];
        const costPer = recipe.yield > 0 ? (recipe.totalCost / recipe.yield) : recipe.totalCost;
        
        const div = document.createElement('div');
        div.style.background = '#09090b'; div.style.border = '1px solid #27272a'; div.style.padding = '15px'; div.style.borderRadius = '8px';
        div.innerHTML = `
            <h4 style="margin:0 0 5px 0; color:#fff;">${recipe.name}</h4>
            <div style="font-size:0.8rem; color:#a1a1aa; margin-bottom:15px;">Yields: ${recipe.yield}</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span>Batch Cost:</span> <strong>$${recipe.totalCost.toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:0.9rem;"><span>Cost Per Yield:</span> <strong style="color:#10b981;">$${costPer.toFixed(2)}</strong></div>
            <button class="btn btn-alert w-100" style="padding:6px; font-size:0.8rem;" onclick="deletePrep('${key}')">Delete</button>
        `;
        container.appendChild(div);
    });
}
window.deletePrep = function(key) { if(confirm("Delete this recipe?")) db.ref(currentLocation + '/food_prep_recipes/' + key).remove(); }

// --- 7. Cloud Suppliers ---
window.openSupplierModal = function() { document.getElementById('supplier-modal').style.display = 'flex'; }
window.saveSupplier = function() {
    const name = document.getElementById('sup-name').value;
    const phone = document.getElementById('sup-phone').value;
    const items = document.getElementById('sup-items').value;
    if(!name) return;
    db.ref(currentLocation + '/food_suppliers').push({ name, phone, items }).then(() => {
        document.getElementById('supplier-modal').style.display = 'none';
        document.getElementById('sup-name').value = ''; document.getElementById('sup-phone').value = ''; document.getElementById('sup-items').value = '';
    });
}
window.deleteSupplier = function(key) { if(confirm("Remove supplier?")) db.ref(currentLocation + '/food_suppliers/' + key).remove(); }

function renderSuppliers() {
    const list = document.getElementById('supplier-list');
    list.innerHTML = '';
    Object.keys(globalSuppliers).forEach(key => {
        const s = globalSuppliers[key];
        const li = document.createElement('li');
        li.className = 'supplier-item';
        li.innerHTML = `
            <div class="supplier-info">
                <h4>${s.name}</h4>
                <p>Provides: ${s.items}</p>
            </div>
            <div style="display:flex; gap:10px;">
                <a href="tel:${s.phone}" class="btn btn-secondary" style="text-decoration: none; font-size: 0.8rem;">Call</a>
                <button class="btn btn-alert" style="padding: 4px 8px;" onclick="deleteSupplier('${key}')">X</button>
            </div>
        `;
        list.appendChild(li);
    });
}

// --- 8. UI & Tab Logic ---
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); 
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active-tab'));
        const targetId = item.getAttribute('href').substring(1); 
        document.getElementById(targetId).classList.add('active-tab');
        document.querySelector('.top-header h1').textContent = item.textContent;
    });
});
