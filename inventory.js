/**
 * PrepTrack - Frontend Logic
 * Handles dynamic rendering, inventory calculations, form submissions, and tab navigation.
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

// --- 3. Core Functions ---

// Render the main inventory table
function renderInventory(data) {
    inventoryBody.innerHTML = '';
    let totalInvValue = 0;
    let lowStockCount = 0;

    data.forEach(item => {
        const totalCost = item.qty * item.cost;
        totalInvValue += totalCost;

        // Determine Status
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
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="updateStock(${item.id}, 1)">+</button>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="updateStock(${item.id}, -1)">-</button>
            </td>
        `;
        inventoryBody.appendChild(row);
    });

    // Update Dashboard Metrics
    totalValueEl.textContent = `$${totalInvValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    lowStockCountEl.textContent = lowStockCount;
}

// Populate the waste form dropdown
function populateWasteDropdown() {
    wasteItemSelect.innerHTML = '<option value="" disabled selected>Select an item...</option>';
    inventoryData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.unit})`;
        wasteItemSelect.appendChild(option);
    });
}

// Render the supplier quick-contact list
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

// Quick Add/Subtract stock
window.updateStock = function(id, change) {
    const item = inventoryData.find(i => i.id === id);
    if (item) {
        item.qty += change;
        if (item.qty < 0) item.qty = 0; // Prevent negative stock
        renderInventory(inventoryData);
    }
};

// Search filtering
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filteredData = inventoryData.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.category.toLowerCase().includes(term)
    );
    renderInventory(filteredData);
});

// Waste Log Submission
wasteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const itemId = parseInt(wasteItemSelect.value);
    const wasteQty = parseFloat(document.getElementById('waste-qty').value);
    
    const item = inventoryData.find(i => i.id === itemId);
    
    if (item && item.qty >= wasteQty) {
        // Deduct from inventory
        item.qty -= wasteQty;
        
        // Calculate financial loss
        const lossValue = wasteQty * item.cost;
        totalWasteValue += lossValue;
        
        // Update UI
        wasteValueEl.textContent = `$${totalWasteValue.toFixed(2)}`;
        renderInventory(inventoryData);
        
        // Reset form
        wasteForm.reset();
        
        // In a real app, you'd show a success toast here
        console.log(`Logged ${wasteQty} ${item.unit} of ${item.name} as waste. Loss: $${lossValue.toFixed(2)}`);
    } else {
        alert("Cannot log more waste than current stock quantity.");
    }
});

// --- 5. Tab Navigation Logic ---
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Ensure proper initial state: Dashboard active, header text dynamic
const topHeaderTitle = document.querySelector('.top-header h1');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); 

        // 1. Remove 'active' class from all sidebar links
        navItems.forEach(nav => nav.classList.remove('active'));
        
        // 2. Add 'active' class to the clicked link
        item.classList.add('active');

        // 3. Hide all tab contents
        tabContents.forEach(content => content.classList.remove('active-tab'));

        // 4. Show the target tab content based on the href attribute
        const targetId = item.getAttribute('href').substring(1); 
        document.getElementById(targetId).classList.add('active-tab');

        // 5. Update Header Title dynamically
        topHeaderTitle.textContent = item.textContent;
    });
});

// --- 6. Initialization ---
function initApp() {
    renderInventory(inventoryData);
    populateWasteDropdown();
    renderSuppliers();
}

// Boot up the application
initApp();
