/**
 * PrepTrack - Frontend Logic
 */

// --- 1. Mock Data Source ---
let inventoryData = [
    { id: 1, name: 'Roma Tomatoes', category: 'Produce', qty: 15, unit: 'lbs', threshold: 10, cost: 1.50 },
    { id: 2, name: 'Yellow Onions', category: 'Produce', qty: 8, unit: 'lbs', threshold: 15, cost: 0.80 }, 
    { id: 3, name: 'Heavy Cream', category: 'Dairy', qty: 4, unit: 'gallons', threshold: 6, cost: 14.00 }, 
    { id: 4, name: 'All-Purpose Flour', category: 'Dry Goods', qty: 50, unit: 'lbs', threshold: 20, cost: 0.60 },
    { id: 5, name: 'Olive Oil', category: 'Dry Goods', qty: 12, unit: 'cases', threshold: 5, cost: 45.00 }
];

const suppliers = [
    { name: 'FreshFarms Produce', phone: '555-0192', items: 'Produce' },
    { name: 'Valley Dairy Co.', phone: '555-0344', items: 'Dairy' },
    { name: 'Sysco / US Foods', phone: '555-0911', items: 'Dry Goods' }
];

let totalWasteValue = 0;

// --- 2. DOM Elements ---
const inventoryBody = document.getElementById('inventory-body');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const wasteItemSelect = document.getElementById('waste-item');
const supplierListEl = document.getElementById('supplier-list');
const searchInput = document.getElementById('search-input');
const wasteForm = document.getElementById('waste-form');
const wasteValueEl = document.getElementById('waste-value');

// Modal Elements
const deliveryModal = document.getElementById('delivery-modal');
const btnReceiveDelivery = document.getElementById('btn-receive-delivery');
const closeDeliveryBtn = document.getElementById('close-delivery');
const deliveryForm = document.getElementById('delivery-form');
const existingItemsDatalist = document.getElementById('existing-items');

// --- 3. Core Functions ---

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
            <td>${item.qty} ${item.unit}</td>
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
    // Populate Waste Form
    wasteItemSelect.innerHTML = '<option value="" disabled selected>Select an item...</option>';
    // Populate Delivery Datalist
    existingItemsDatalist.innerHTML = '';

    inventoryData.forEach(item => {
        // Waste
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.unit})`;
        wasteItemSelect.appendChild(option);

        // Datalist
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

// --- 4. Interactions & Event Listeners ---

// Quick usage (now only subtracts for daily prep usage)
window.updateStock = function(id, change) {
    const item = inventoryData.find(i => i.id === id);
    if (item && item.qty > 0) {
        item.qty += change;
        if (item.qty < 0) item.qty = 0; 
        renderInventory(inventoryData);
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

// Modal Logic
btnReceiveDelivery.addEventListener('click', () => {
    deliveryModal.classList.add('active-modal');
});

closeDeliveryBtn.addEventListener('click', () => {
    deliveryModal.classList.remove('active-modal');
});

// Close modal if clicking outside the white box
window.addEventListener('click', (e) => {
    if (e.target === deliveryModal) {
        deliveryModal.classList.remove('active-modal');
    }
});

// Process Delivery Submission
deliveryForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('del-name').value.trim();
    const catInput = document.getElementById('del-category').value;
    const qtyInput = parseFloat(document.getElementById('del-qty').value);
    const unitInput = document.getElementById('del-unit').value.trim();
    const costInput = parseFloat(document.getElementById('del-cost').value);
    const thresholdInput = parseInt(document.getElementById('del-threshold').value);

    // Check if item already exists (case insensitive)
    const existingItem = inventoryData.find(i => i.name.toLowerCase() === nameInput.toLowerCase());

    if (existingItem) {
        // Update existing item
        existingItem.qty += qtyInput;
        existingItem.cost = costInput; // Overwrites old price with new delivery price
        existingItem.threshold = thresholdInput;
        existingItem.category = catInput;
        existingItem.unit = unitInput;
    } else {
        // Create new item
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

    // Refresh UI and close modal
    renderInventory(inventoryData);
    populateDropdowns();
    deliveryForm.reset();
    deliveryModal.classList.remove('active-modal');
});

// Waste Log
wasteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const itemId = parseInt(wasteItemSelect.value);
    const wasteQty = parseFloat(document.getElementById('waste-qty').value);
    const item = inventoryData.find(i => i.id === itemId);
    
    if (item && item.qty >= wasteQty) {
        item.qty -= wasteQty;
        totalWasteValue += (wasteQty * item.cost);
        wasteValueEl.textContent = `$${totalWasteValue.toFixed(2)}`;
        renderInventory(inventoryData);
        wasteForm.reset();
    } else {
        alert("Cannot log more waste than current stock quantity.");
    }
});

// --- 5. Tab Navigation Logic ---
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

// --- 6. Initialization ---
function initApp() {
    renderInventory(inventoryData);
    populateDropdowns();
    renderSuppliers();
}

initApp();
