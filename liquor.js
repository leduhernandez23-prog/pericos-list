document.getElementById('loc-display').innerText = currentLocation.replace('LP_', '');
document.getElementById('user-display').innerText = activeUser;

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

let isInitialLoad = false;
let deletedStack = [];
let inventoryLookup = {}; 
let collapsedCats = {}; 
let editingCocktailId = null; 

const catColors = {
    'Tequila': '#00E676', 'Vodka': '#00b0ff', 'Whiskey': '#ff9f43',
    'Rum': '#ff4757', 'Gin': '#00e5ff', 'Liqueur': '#d500f9',
    'Mixer': '#ffea00', 'Beer': '#ffd600', 'Wine': '#880e4f'
};

window.addEventListener('scroll', () => {
  const btn = document.getElementById('fab-top');
  if(window.scrollY > 300) btn.classList.add('visible');
  else btn.classList.remove('visible');
});
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToBottom() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }

firebase.auth().onAuthStateChanged((user) => {
    if (user && activeUser) {
        const dot = document.getElementById('sync-indicator');
        const text = document.getElementById('sync-text');
        text.innerText = "Connected";
        dot.style.background = "var(--neon-green)";
        dot.style.boxShadow = "var(--neon-glow)";
        loadFirebaseData();
    } else {
        window.location.href = 'index.html';
    }
});

function loadFirebaseData() {
    db.ref(currentLocation + '/liquor_inventory').once('value', snap => {
        const data = snap.val();
        const tbody = document.getElementById('inventory-body');
        tbody.innerHTML = '';
        if(data) {
            data.forEach(item => { if(item) injectInventoryRow(item); });
            sortInventory();
            updateInventoryDatalist(); 
        } else { addInventoryRow(); }
        
        db.ref(currentLocation + '/liquor_builder_draft').once('value', snap2 => {
            const cData = snap2.val();
            const cbody = document.getElementById('ingredients-container');
            cbody.innerHTML = '';
            if(cData && cData.ingredients) {
                editingCocktailId = cData.editingId || null;
                document.getElementById('cocktail-name').value = cData.name || '';
                document.getElementById('batch-yield').value = cData.yield || 1;
                document.getElementById('menu-price').value = cData.price || '';
                cData.ingredients.forEach(ing => { if(ing) injectIngredientRow(ing); });
            } else { addIngredientRow(); }
            calculateCocktail();
            isInitialLoad = true;
            renderMarginDashboard();
        });
    });

    db.ref(currentLocation + '/liquor_menu').on('value', snap => {
        renderMenuVault(snap.val());
    });

    db.ref(currentLocation + '/liquor_meta').on('value', snap => {
        const meta = snap.val();
        if(meta && meta.lastEditedBy) {
            const time = new Date(meta.lastEditedAt).toLocaleTimeString();
            document.getElementById('last-edited-by').innerHTML = `${meta.lastEditedBy} <br><span style="font-weight:normal; font-size:0.7rem;">${time}</span>`;
            if(meta.posSales !== undefined && document.getElementById('pos-sales').value === '') {
                document.getElementById('pos-sales').value = meta.posSales;
                calculateGlobalMetrics();
            }
        }
    });
}

function flashSync() {
    const dot = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');
    text.innerText = "Syncing...";
    dot.style.background = "var(--neon-orange)";
    dot.style.boxShadow = "var(--neon-orange-glow)";
    setTimeout(() => {
        text.innerText = "Cloud Synced";
        dot.style.background = "var(--neon-green)";
        dot.style.boxShadow = "var(--neon-glow)";
    }, 800);
}

function autoSaveInv() {
    if(!isInitialLoad) return;
    const data = [];
    let seen = new Set();
    document.querySelectorAll('#inventory-body .inv-row').forEach(row => {
         const cat = row.querySelector('.i-category').value;
         const brand = row.querySelector('.i-brand').value;
         const size = parseFloat(row.querySelector('.i-size').value) || 0;
         const unit = row.querySelector('.i-unit').value;
         const cost = parseFloat(row.querySelector('.i-cost').value) || 0;
         const sell = parseFloat(row.querySelector('.i-shot-sell').value) || 0;
         
         if(cost === 0 || sell === 0) { row.classList.add('price-warning'); } 
         else { row.classList.remove('price-warning'); }

         const checkKey = `${brand.trim().toLowerCase()}|${size}|${unit}`;
         if(brand.trim() !== '' && seen.has(checkKey)) { row.style.background = 'rgba(255, 71, 87, 0.15)'; } 
         else { row.style.background = 'rgba(0,0,0,0.4)'; seen.add(checkKey); }

         data.push({
             category: cat, brand: brand, size: size, unit: unit,
             start: parseFloat(row.getAttribute('data-start')) || 0,
             received: parseFloat(row.getAttribute('data-received')) || 0,
             count: parseFloat(row.querySelector('.i-count').value) || 0,
             cost: cost, shotSell: sell
         });
    });
    db.ref(currentLocation + '/liquor_inventory').set(data)
      .then(() => { updateMeta(); renderMarginDashboard(); updateInventoryDatalist(); })
      .catch(error => console.error("Firebase Save Error: ", error));
}

function autoSaveDraft() {
    if(!isInitialLoad) return;
    const data = getCocktailDataFromBuilder();
    data.editingId = editingCocktailId; 
    db.ref(currentLocation + '/liquor_builder_draft').set(data);
}

function autoSaveMeta() {
    if(!isInitialLoad) return;
    updateMeta(); calculateGlobalMetrics();
}

function updateMeta() {
    db.ref(currentLocation + '/liquor_meta').update({
         lastEditedBy: activeUser,
         lastEditedAt: firebase.database.ServerValue.TIMESTAMP,
         posSales: parseFloat(document.getElementById('pos-sales').value) || 0
    });
    flashSync();
}

const catOptions = ['Tequila', 'Vodka', 'Whiskey', 'Rum', 'Gin', 'Liqueur', 'Mixer', 'Beer', 'Wine'];
const unitOptions = ['ml', 'oz', 'L'];
const builderUnitOptions = ['ml', 'oz', 'L', 'dash', 'ea']; 

function toggleCategory(cat) {
    collapsedCats[cat] = !collapsedCats[cat];
    filterInventory(); 
    const headerIcon = document.querySelector(`.cat-header[data-target-cat="${cat}"] .cat-icon`);
    if(headerIcon) headerIcon.innerText = collapsedCats[cat] ? '▶' : '▼';
}

function sortInventory() {
    const tbody = document.getElementById('inventory-body');
    const rows = Array.from(tbody.querySelectorAll('.inv-row'));
    rows.sort((a, b) => {
        const catA = a.querySelector('.i-category').value;
        const catB = b.querySelector('.i-category').value;
        const idxA = catOptions.indexOf(catA);
        const idxB = catOptions.indexOf(catB);
        const brandA = a.querySelector('.i-brand').value.toLowerCase();
        const brandB = b.querySelector('.i-brand').value.toLowerCase();
        if (idxA !== idxB) return idxA - idxB;
        if (brandA < brandB) return -1;
        if (brandA > brandB) return 1;
        return 0;
    });
    tbody.innerHTML = '';
    let currentCat = '';
    rows.forEach(row => {
        const cat = row.querySelector('.i-category').value;
        row.style.borderLeft = `4px solid ${catColors[cat] || '#fff'}`;
        if (cat !== currentCat) {
            currentCat = cat;
            const header = document.createElement('tr');
            header.className = 'cat-header';
            header.setAttribute('data-target-cat', cat);
            header.innerHTML = `<td colspan="8" onclick="toggleCategory('${cat}')">
                <div style="display:flex; justify-content:space-between; color:${catColors[cat] || '#fff'}; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">
                    <span>${cat}</span>
                    <span class="cat-icon">${collapsedCats[cat] ? '▶' : '▼'}</span>
                </div>
            </td>`;
            tbody.appendChild(header);
        }
        tbody.appendChild(row);
    });
    filterInventory();
}

function filterInventory() {
  const textFilter = document.getElementById('inventory-search').value.toUpperCase();
  const catFilter = document.getElementById('category-filter').value.toUpperCase();
  document.querySelectorAll('.inv-row').forEach(row => {
    const brand = row.querySelector('.i-brand').value.toUpperCase();
    const cat = row.querySelector('.i-category').value.toUpperCase();
    const matchesText = brand.includes(textFilter) || cat.includes(textFilter);
    const matchesCat = (catFilter === 'ALL' || cat === catFilter);
    const isCollapsed = collapsedCats[row.querySelector('.i-category').value];
    row.style.display = (matchesText && matchesCat && !isCollapsed) ? "" : "none";
  });
  document.querySelectorAll('.cat-header').forEach(header => {
      const targetCat = header.getAttribute('data-target-cat').toUpperCase();
      header.style.display = (catFilter === 'ALL' || targetCat === catFilter) ? "" : "none";
  });
}

function adjustCount(btn, amount) {
    const input = btn.parentElement.querySelector('.i-count');
    let val = parseFloat(input.value) || 0;
    val = Math.max(0, val + amount);
    input.value = val.toFixed(1);
    autoSaveInv();
}

function convertToOz(size, unit) {
  if (unit === 'ml') return size / 29.5735;
  if (unit === 'L') return (size * 1000) / 29.5735;
  if (unit === 'dash') return size * 0.03125; 
  if (unit === 'ea') return size; 
  return size; 
}

function injectInventoryRow(item) {
    const tbody = document.getElementById('inventory-body');
    const tr = document.createElement('tr');
    tr.className = 'inv-row';
    tr.setAttribute('data-received', item.received || 0);
    tr.setAttribute('data-start', item.start || 0);
    
    let catHtml = catOptions.map(c => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`).join('');
    let unitHtml = unitOptions.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('');

    if(isInitialLoad && (item.cost === 0 || item.shotSell === 0)) { tr.classList.add('price-warning'); }

    tr.innerHTML = `
      <td data-label="Category"><select class="i-category clean-input col-med" onchange="autoSaveInv(); sortInventory()">${catHtml}</select></td>
      <td data-label="Brand"><input type="text" placeholder="Brand Name" class="clean-input col-large i-brand" value="${item.brand || ''}" oninput="autoSaveInv()" onchange="sortInventory()"></td>
      <td data-label="Size & Unit" style="display: flex; gap: 5px; align-items: center;">
        <input type="number" class="clean-input i-size col-small" value="${item.size || 750}" oninput="autoSaveInv()">
        <select class="clean-input i-unit" onchange="autoSaveInv()" style="width: 70px; padding: 10px 5px;">${unitHtml}</select>
      </td>
      <td data-label="Current Count">
        <div class="stepper">
          <button type="button" class="stepper-btn" onclick="adjustCount(this, -0.1)">-</button>
          <input type="number" class="clean-input i-count col-small" value="${item.count || 0}" step="0.1" oninput="autoSaveInv()">
          <button type="button" class="stepper-btn" onclick="adjustCount(this, 0.1)">+</button>
        </div>
      </td>
      <td data-label="Received Btls" class="data-highlight calc-received" style="color: var(--neon-blue); padding-left:15px;">${item.received || 0}</td>
      <td data-label="Btl Cost ($)"><input type="number" class="clean-input i-cost col-small" value="${item.cost || 0}" step="0.01" oninput="autoSaveInv()"></td>
      <td data-label="Shot Sell ($)"><input type="number" class="clean-input i-shot-sell col-small" value="${item.shotSell || 0}" step="0.01" oninput="autoSaveInv()"></td>
      <td data-label=""><button class="btn-remove" onclick="removeEl(this)">×</button></td>
    `;
    tbody.appendChild(tr);
    filterInventory(); 
}

function addInventoryRow() {
    injectInventoryRow({ category: 'Tequila', unit: 'ml', size: 750, start: 0, received: 0, count: 0, cost: 0, shotSell: 0 });
    sortInventory(); autoSaveInv();
}

function filterDashboard() {
  const filter = document.getElementById('dashboard-search').value.toUpperCase();
  const rows = document.getElementById('dashboard-body').getElementsByTagName('tr');
  for (let i = 0; i < rows.length; i++) {
    const brand = rows[i].getElementsByTagName('td')[0].innerText.toUpperCase();
    rows[i].style.display = brand.includes(filter) ? "" : "none";
  }
}

function renderMarginDashboard() {
    const tbody = document.getElementById('dashboard-body');
    tbody.innerHTML = '';
    let totalUsageCost = 0;
    document.querySelectorAll('#inventory-body .inv-row').forEach(row => {
        const brand = row.querySelector('.i-brand').value || 'Unnamed Spirit';
        const rawSize = parseFloat(row.querySelector('.i-size').value) || 1;
        const unit = row.querySelector('.i-unit').value;
        const sizeOz = convertToOz(rawSize, unit);
        const start = parseFloat(row.getAttribute('data-start')) || 0;
        const received = parseFloat(row.getAttribute('data-received')) || 0;
        const count = parseFloat(row.querySelector('.i-count').value) || 0;
        const cost = parseFloat(row.querySelector('.i-cost').value) || 0;
        const sell = parseFloat(row.querySelector('.i-shot-sell').value) || 0;

        const usageBtls = (start + received) - count;
        const usageCost = usageBtls * cost;
        if (usageCost > 0) totalUsageCost += usageCost;

        const shotCost = (cost / sizeOz) * 1.5;
        const shotProfit = sell - shotCost;
        let pourCostPct = 0; let pourClass = ''; let profitClass = '';

        if (sell > 0) {
            pourCostPct = (shotCost / sell) * 100;
            if (pourCostPct <= 20) { pourClass = 'status-good'; profitClass = 'status-good'; } 
            else { pourClass = 'status-warn'; profitClass = 'status-warn'; }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Brand" style="font-weight: bold; color: var(--text-main);">${brand}</td>
            <td data-label="Btls Used" style="color: var(--neon-orange); font-family: monospace; font-size: 1.1rem;">${Math.max(0, usageBtls).toFixed(1)}</td>
            <td data-label="Usage Cost ($)" style="font-family: monospace; font-size: 1.1rem;">$${Math.max(0, usageCost).toFixed(2)}</td>
            <td data-label="Shot Cost ($)" style="font-family: monospace; font-size: 1.1rem;">$${shotCost.toFixed(2)}</td>
            <td data-label="Shot Profit ($)" class="${profitClass}" style="font-family: monospace; font-size: 1.1rem;">$${shotProfit.toFixed(2)}</td>
            <td data-label="Pour Cost %" class="${pourClass}" style="font-family: monospace; font-size: 1.1rem;">${sell > 0 ? pourCostPct.toFixed(2) + '%' : '0.00%'}</td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('global-usage-cost').innerText = `$${totalUsageCost.toFixed(2)}`;
    calculateGlobalMetrics(totalUsageCost);
}

function calculateGlobalMetrics(totalUsageCost) {
  if (totalUsageCost === undefined) totalUsageCost = parseFloat(document.getElementById('global-usage-cost').innerText.replace('$','')) || 0;
  const posSales = parseFloat(document.getElementById('pos-sales').value) || 0;
  const pourDisplay = document.getElementById('global-pour-cost');
  const pourBox = document.getElementById('global-pour-box');

  if (posSales > 0) {
    const globalPourPct = (totalUsageCost / posSales) * 100;
    pourDisplay.innerText = `${globalPourPct.toFixed(2)}%`;
    if (globalPourPct <= 20) { pourDisplay.className = 'value status-good'; pourBox.style.borderLeftColor = 'var(--neon-green)'; } 
    else { pourDisplay.className = 'value status-warn'; pourBox.style.borderLeftColor = 'var(--danger)'; }
  } else {
    pourDisplay.innerText = '0.00%'; pourDisplay.className = 'value'; pourBox.style.borderLeftColor = 'var(--neon-green)';
  }
}

function openTab(event, tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if(event && event.currentTarget) event.currentTarget.classList.add('active');
  
  const addBtn = document.getElementById('fab-add');
  if(tabId === 'dashboard') addBtn.style.display = 'none';
  else { 
    addBtn.style.display = 'flex'; 
    addBtn.onclick = tabId === 'builder' ? () => { addIngredientRow(); scrollToBottom(); } : () => { addInventoryRow(); scrollToBottom(); };
  }
}

function getInventoryOptionsHTML() {
  let optionsHTML = '';
  document.querySelectorAll('.inv-row').forEach((row, index) => {
    const brand = row.querySelector('.i-brand').value.trim() || 'Unnamed Spirit';
    const cat = row.querySelector('.i-category').value;
    optionsHTML += `<option value="${index}">${brand} (${cat})</option>`;
  });
  return optionsHTML;
}
function addDeliveryRow() {
  const list = document.getElementById('delivery-batch-list');
  const div = document.createElement('div');
  div.className = 'delivery-row';
  div.innerHTML = `<select class="clean-input" style="flex: 2; background:rgba(0,0,0,0.5);">${getInventoryOptionsHTML()}</select><input class="clean-input" type="number" placeholder="Qty" min="0" step="1" style="flex: 1; background:rgba(0,0,0,0.5);"><button class="btn-remove" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(div);
}
function openReceiveModal() { document.getElementById('delivery-batch-list').innerHTML = ''; addDeliveryRow(); document.getElementById('receive-modal').style.display = 'flex'; }
function closeReceiveModal() { document.getElementById('receive-modal').style.display = 'none'; }
function confirmBatchReceive() {
  const rows = document.querySelectorAll('.delivery-row');
  const invRows = document.querySelectorAll('.inv-row');
  rows.forEach(dRow => {
    const select = dRow.querySelector('select');
    const input = dRow.querySelector('input');
    if (select && input) {
      const rowIndex = select.value;
      const amount = parseFloat(input.value) || 0;
      if (amount > 0 && invRows[rowIndex]) {
        const targetRow = invRows[rowIndex];
        const currentRec = parseFloat(targetRow.getAttribute('data-received')) || 0;
        targetRow.setAttribute('data-received', currentRec + amount);
        targetRow.querySelector('.calc-received').innerText = currentRec + amount;
      }
    }
  });
  autoSaveInv(); closeReceiveModal();
}

function openSummaryModal() {
  const list = document.getElementById('weekly-summary-list');
  list.innerHTML = ''; let totalUsageCost = 0;
  document.querySelectorAll('.inv-row').forEach(row => {
    const brand = row.querySelector('.i-brand').value || 'Unnamed Spirit';
    const start = parseFloat(row.getAttribute('data-start')) || 0;
    const received = parseFloat(row.getAttribute('data-received')) || 0;
    const count = parseFloat(row.querySelector('.i-count').value) || 0;
    const cost = parseFloat(row.querySelector('.i-cost').value) || 0;
    const usageBtls = (start + received) - count;
    const lineCost = usageBtls * cost;
    if (usageBtls > 0) {
      totalUsageCost += lineCost;
      const li = document.createElement('li');
      li.style.padding = '10px 0'; li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      li.innerHTML = `<span style="color: var(--neon-blue); font-weight: 500;">${brand}:</span> Used ${usageBtls.toFixed(1)} btls <span style="float: right; color: var(--neon-green);">+$${lineCost.toFixed(2)}</span>`;
      list.appendChild(li);
    }
  });
  if (list.innerHTML === '') list.innerHTML = `<li style="color: var(--text-muted); padding: 10px 0;">No usage recorded for this week yet.</li>`;
  document.getElementById('weekly-summary-total').innerText = `$${totalUsageCost.toFixed(2)}`;
  document.getElementById('summary-modal').style.display = 'flex';
}
function closeSummaryModal() { document.getElementById('summary-modal').style.display = 'none'; }
function confirmResetWeek() {
  document.querySelectorAll('.inv-row').forEach(row => {
    const currentCount = parseFloat(row.querySelector('.i-count').value) || 0;
    row.setAttribute('data-start', currentCount);
    row.setAttribute('data-received', '0');
    row.querySelector('.calc-received').innerText = '0';
  });
  autoSaveInv(); closeSummaryModal();
}

function updateInventoryDatalist() {
    const datalist = document.getElementById('inventory-datalist');
    if(!datalist) return;
    datalist.innerHTML = ''; inventoryLookup = {}; 
    document.querySelectorAll('#inventory-body .inv-row').forEach(row => {
        const brand = row.querySelector('.i-brand').value.trim();
        const size = row.querySelector('.i-size').value;
        const unit = row.querySelector('.i-unit').value;
        const cost = row.querySelector('.i-cost').value;
        if(brand) {
            const option = document.createElement('option');
            option.value = brand; datalist.appendChild(option);
            inventoryLookup[brand.toLowerCase()] = { size, unit, cost };
        }
    });
}

function handleIngredientChange(input) {
    const val = input.value.trim().toLowerCase();
    if (inventoryLookup[val]) {
        const row = input.closest('.ingredient-row');
        const data = inventoryLookup[val];
        row.querySelector('.c-size').value = data.size;
        row.querySelector('.c-unit').value = data.unit;
        row.querySelector('.c-cost').value = data.cost;
        calculateCocktail();
    }
    autoSaveDraft();
}

function removeEl(btn) {
  const row = btn.closest('tr, .ingredient-row');
  deletedStack.push({ row: row, parent: row.parentElement, nextSibling: row.nextElementSibling });
  row.remove();
  document.getElementById('undo-btn-inv').style.display = 'inline-block';
  document.getElementById('undo-btn-build').style.display = 'inline-block';
  if(row.classList.contains('inv-row')) { autoSaveInv(); } else { autoSaveDraft(); calculateCocktail(); }
}

function undoDelete() {
  if (deletedStack.length > 0) {
    const last = deletedStack.pop();
    if (last.nextSibling && last.nextSibling.parentNode === last.parent) last.parent.insertBefore(last.row, last.nextSibling);
    else last.parent.appendChild(last.row);
    if(last.row.classList.contains('inv-row')) { sortInventory(); autoSaveInv(); } 
    else { autoSaveDraft(); calculateCocktail(); }
  }
  if (deletedStack.length === 0) { 
      document.getElementById('undo-btn-inv').style.display = 'none'; 
      document.getElementById('undo-btn-build').style.display = 'none'; 
  }
}

function injectIngredientRow(ing) {
    const container = document.getElementById('ingredients-container');
    const div = document.createElement('div');
    div.className = 'builder-grid ingredient-row';
    let unitHtml = builderUnitOptions.map(u => `<option value="${u}" ${u === ing.unit ? 'selected' : ''}>${u}</option>`).join('');
    
    div.innerHTML = `
      <input type="text" placeholder="Ingredient / Auto-fill" class="clean-input c-name" value="${ing.name || ''}" list="inventory-datalist" oninput="handleIngredientChange(this)">
      <input type="number" placeholder="Pour Oz" class="clean-input c-pour" value="${ing.pour || 1}" step="0.25" oninput="calculateCocktail(); autoSaveDraft()">
      <div style="display: flex; gap: 5px;">
        <input type="number" placeholder="Btl Size" class="clean-input c-size" value="${ing.size || 750}" oninput="calculateCocktail(); autoSaveDraft()">
        <select class="clean-input c-unit" onchange="calculateCocktail(); autoSaveDraft()" style="width: 70px; padding: 10px 5px;">${unitHtml}</select>
      </div>
      <input type="number" placeholder="Btl Cost" class="clean-input c-cost" value="${ing.cost || 15}" step="0.01" oninput="calculateCocktail(); autoSaveDraft()">
      <div class="data-highlight c-line-cost">$0.00</div>
      <button class="btn-remove" onclick="removeEl(this)">Remove</button>
    `;
    container.appendChild(div);
}

function addIngredientRow() {
    injectIngredientRow({ unit: 'ml', size: 750, pour: 1, cost: 15 });
    calculateCocktail(); autoSaveDraft();
}

function getCocktailDataFromBuilder() {
    const data = {
        name: document.getElementById('cocktail-name').value,
        price: parseFloat(document.getElementById('menu-price').value) || 0,
        yield: parseFloat(document.getElementById('batch-yield').value) || 1,
        ingredients: [],
        totalCost: 0,
        costPerDrink: 0,
        pourCostPct: 0
    };
    document.querySelectorAll('.ingredient-row').forEach(row => {
        const pourOz = parseFloat(row.querySelector('.c-pour').value) || 0;
        const rawSize = parseFloat(row.querySelector('.c-size').value) || 1; 
        const unit = row.querySelector('.c-unit').value;
        const btlCost = parseFloat(row.querySelector('.c-cost').value) || 0;
        const lineCost = pourOz * (btlCost / convertToOz(rawSize, unit));
        
        data.ingredients.push({
            name: row.querySelector('.c-name').value,
            pour: pourOz, size: rawSize, unit: unit, cost: btlCost
        });
        data.totalCost += lineCost;
    });
    
    data.costPerDrink = data.totalCost / data.yield;
    if(data.price > 0) { data.pourCostPct = (data.costPerDrink / data.price) * 100; }
    return data;
}

function calculateCocktail() {
  const data = getCocktailDataFromBuilder();
  
  document.querySelectorAll('.ingredient-row').forEach((row, index) => {
      const ing = data.ingredients[index];
      const lineCost = ing.pour * (ing.cost / convertToOz(ing.size, ing.unit));
      row.querySelector('.c-line-cost').innerText = `$${lineCost.toFixed(2)}`;
  });

  document.getElementById('cocktail-batch-cost').innerText = `$${data.totalCost.toFixed(2)}`;
  document.getElementById('cocktail-cost').innerText = `$${data.costPerDrink.toFixed(2)}`;
  
  const profitDisplay = document.getElementById('cocktail-profit');
  const pourDisplay = document.getElementById('cocktail-pour-cost');
  const classDisplay = document.getElementById('cocktail-class');
  const pourBox = document.getElementById('cocktail-pour-box');

  if (data.price > 0) {
    profitDisplay.innerText = `$${(data.price - data.costPerDrink).toFixed(2)}`;
    pourDisplay.innerText = `${data.pourCostPct.toFixed(2)}%`;

    if (data.pourCostPct <= 15) {
      classDisplay.innerText = '🌟 STAR'; classDisplay.style.color = 'var(--neon-green)';
      pourDisplay.className = 'value status-good'; profitDisplay.className = 'value status-good';
      pourBox.style.borderLeftColor = 'var(--neon-green)';
    } else if (data.pourCostPct <= 20) {
      classDisplay.innerText = '🐴 PLOWHORSE'; classDisplay.style.color = 'var(--text-main)';
      pourDisplay.className = 'value'; profitDisplay.className = 'value';
      pourBox.style.borderLeftColor = 'var(--text-muted)';
    } else {
      classDisplay.innerText = '🐕 DOG'; classDisplay.style.color = 'var(--danger)';
      pourDisplay.className = 'value status-warn'; profitDisplay.className = 'value status-warn';
      pourBox.style.borderLeftColor = 'var(--danger)';
    }
  } else {
    profitDisplay.innerText = `$0.00`; pourDisplay.innerText = `0.00%`; classDisplay.innerText = '--';
    pourDisplay.className = 'value'; profitDisplay.className = 'value'; pourBox.style.borderLeftColor = 'var(--neon-green)';
  }
}

function saveCocktailToMenu() {
    const data = getCocktailDataFromBuilder();
    if(data.name.trim() === '') {
        alert("Please give the cocktail a name before saving.");
        return;
    }
    let ref = editingCocktailId ? db.ref(currentLocation + '/liquor_menu/' + editingCocktailId) : db.ref(currentLocation + '/liquor_menu').push();
    
    ref.set(data).then(() => {
        editingCocktailId = ref.key; 
        autoSaveDraft(); 
        flashSync();
        
        const btn = document.querySelector('button[onclick="saveCocktailToMenu()"]');
        btn.innerHTML = '✅ Saved';
        btn.style.background = 'var(--neon-green)';
        btn.style.color = '#000';
        setTimeout(() => {
            btn.innerHTML = '💾 Save to Menu';
            btn.style.background = 'transparent';
            btn.style.color = 'var(--neon-blue)';
        }, 2000);
    });
}

function clearBuilder() {
    editingCocktailId = null;
    document.getElementById('cocktail-name').value = '';
    document.getElementById('batch-yield').value = 1;
    document.getElementById('menu-price').value = '';
    document.getElementById('ingredients-container').innerHTML = '';
    addIngredientRow(); 
    calculateCocktail();
    autoSaveDraft();
    scrollToTop();
}

function loadCocktailToBuilder(id, cocktailData) {
    editingCocktailId = id;
    document.getElementById('cocktail-name').value = cocktailData.name || '';
    document.getElementById('batch-yield').value = cocktailData.yield || 1;
    document.getElementById('menu-price').value = cocktailData.price || '';
    
    const container = document.getElementById('ingredients-container');
    container.innerHTML = '';
    if(cocktailData.ingredients) {
        cocktailData.ingredients.forEach(ing => injectIngredientRow(ing));
    } else {
        addIngredientRow();
    }
    
    calculateCocktail();
    autoSaveDraft();
    scrollToTop();
}

function deleteFromMenu(id) {
    if(confirm("Are you sure you want to delete this cocktail from the menu?")) {
        db.ref(currentLocation + '/liquor_menu/' + id).remove();
        if(editingCocktailId === id) { clearBuilder(); }
    }
}

function renderMenuVault(menuData) {
    const container = document.getElementById('menu-vault-container');
    container.innerHTML = '';
    
    if(!menuData) {
        container.innerHTML = '<p style="color:var(--text-muted);">No cocktails saved to menu yet. Build one above and click "Save to Menu".</p>';
        return;
    }

    Object.keys(menuData).forEach(key => {
        const drink = menuData[key];
        const div = document.createElement('div');
        div.className = 'menu-card';
        
        let classEmoji = '🐕'; let colorClass = 'status-warn';
        if(drink.pourCostPct <= 15) { classEmoji = '🌟'; colorClass = 'status-good'; }
        else if (drink.pourCostPct <= 20) { classEmoji = '🐴'; colorClass = ''; }
        
        const yieldDisplay = drink.yield > 1 ? ` (Yield: ${drink.yield})` : '';

        div.innerHTML = `
            <h4 style="display:flex; justify-content:space-between;">
                ${drink.name} <span>${classEmoji}</span>
            </h4>
            <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:10px;">Price: $${drink.price.toFixed(2)}${yieldDisplay}</div>
            
            <div class="menu-stats">
                <span>Cost / Drink:</span>
                <span>$${(drink.costPerDrink || drink.totalCost).toFixed(2)}</span>
            </div>
            <div class="menu-stats">
                <span>Pour %:</span>
                <span class="${colorClass}">${drink.pourCostPct.toFixed(2)}%</span>
            </div>
            
            <div class="menu-actions">
                <button class="btn-glow" style="flex:1; padding:8px;" onclick='loadCocktailToBuilder("${key}", ${JSON.stringify(drink).replace(/'/g, "&#39;")})'>✎ Edit</button>
                <button class="btn-remove" style="padding:8px;" onclick='deleteFromMenu("${key}")'>Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function exportToCSV() {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += '"Category","Brand","Size","Start Count (Hidden)","Received","Current Count","Btls Used","Cost/Btl","Shot Sell","Usage Cost","Shot Cost","Shot Profit","Shot Pour %"\r\n';

  document.querySelectorAll('.inv-row').forEach(row => {
    const cat = row.querySelector('.i-category').value;
    const brand = row.querySelector('.i-brand').value;
    const rawSize = row.querySelector('.i-size').value;
    const unit = row.querySelector('.i-unit').value;
    const start = parseFloat(row.getAttribute('data-start')) || 0;
    const received = parseFloat(row.getAttribute('data-received')) || 0;
    const count = parseFloat(row.querySelector('.i-count').value) || 0;
    const cost = parseFloat(row.querySelector('.i-cost').value) || 0;
    const sell = parseFloat(row.querySelector('.i-shot-sell').value) || 0;
    
    const btlsUsed = (start + received) - count;
    const usageCost = btlsUsed * cost;
    const sizeOz = convertToOz(rawSize, unit);
    const shotCost = (cost / sizeOz) * 1.5;
    const shotProfit = sell - shotCost;
    const pourCostPct = sell > 0 ? (shotCost / sell) * 100 : 0;
    
    let rowData = [ `"${cat}"`, `"${brand}"`, `"${rawSize} ${unit}"`, `"${start}"`, `"${received}"`, `"${count}"`, `"${btlsUsed.toFixed(1)}"`, `"${cost.toFixed(2)}"`, `"${sell.toFixed(2)}"`, `"${usageCost.toFixed(2)}"`, `"${shotCost.toFixed(2)}"`, `"${shotProfit.toFixed(2)}"`, `"${pourCostPct.toFixed(2)}%"` ];
    csvContent += rowData.join(",") + "\r\n";
  });

  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `Los_Pericos_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
