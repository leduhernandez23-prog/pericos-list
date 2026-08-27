// Sample state data (can be synced with Firebase later)
let staffList = JSON.parse(localStorage.getItem('pericos_compliance')) || [
    { id: '1', name: 'Example Bartender', role: 'Bartender', tabc: '2026-10-15', fhc: '2027-05-20' },
    { id: '2', name: 'Example Server', role: 'Server', tabc: '2026-09-01', fhc: '2026-08-10' }
];

// Generates the colored status badge based on date math
function getStatusBadge(dateString) {
    if (!dateString) return '<span class="text-slate-400 italic">N/A</span>';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const expDate = new Date(dateString);
    expDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-100 text-rose-700"><i class="fa-solid fa-circle-xmark mr-1.5"></i> Expired (${dateString})</span>`;
    } else if (diffDays <= 30) {
        return `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700"><i class="fa-solid fa-clock mr-1.5"></i> Soon (${dateString})</span>`;
    } else {
        return `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check mr-1.5"></i> Valid (${dateString})</span>`;
    }
}

// Renders the main table and updates top counters
function renderTable(filter = '') {
    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '';
    
    let total = staffList.length;
    let expiring = 0;
    let expired = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter list based on search bar input
    const filtered = staffList.filter(s => 
        s.name.toLowerCase().includes(filter.toLowerCase()) || 
        s.role.toLowerCase().includes(filter.toLowerCase())
    );

    filtered.forEach(staff => {
        // Calculate total alerts
        [staff.tabc, staff.fhc].forEach(dateString => {
            if (dateString) {
                const expDate = new Date(dateString);
                expDate.setHours(0,0,0,0);
                const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) expired++;
                else if (diffDays <= 30) expiring++;
            }
        });

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition cursor-default"; 
        tr.innerHTML = `
            <td class="py-4 px-6 font-semibold text-slate-800">${staff.name}</td>
            <td class="py-4 px-6 text-slate-500">${staff.role}</td>
            <td class="py-4 px-6">${getStatusBadge(staff.tabc)}</td>
            <td class="py-4 px-6">${getStatusBadge(staff.fhc)}</td>
            <td class="py-4 px-6 text-right space-x-3">
                <button onclick="editStaff('${staff.id}')" class="text-slate-400 hover:text-indigo-600 transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteStaff('${staff.id}')" class="text-slate-400 hover:text-rose-600 transition" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update DOM stats
    document.getElementById('total-staff').innerText = total;
    document.getElementById('expiring-soon').innerText = expiring;
    document.getElementById('expired-count').innerText = expired;
}

// Modal Controls
function openAddModal() {
    document.getElementById('staff-id').value = '';
    document.getElementById('staff-form').reset();
    document.getElementById('modal-title').innerText = 'Add New Staff Member';
    document.getElementById('staff-modal').classList.remove('hidden');
}

function closeAddModal() {
    document.getElementById('staff-modal').classList.add('hidden');
}

// Save or Update Record
document.getElementById('staff-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('staff-id').value || Date.now().toString();
    const name = document.getElementById('name-input').value;
    const role = document.getElementById('role-input').value;
    const tabc = document.getElementById('tabc-input').value;
    const fhc = document.getElementById('fhc-input').value;

    const existingIndex = staffList.findIndex(s => s.id === id);
    if (existingIndex > -1) {
        // Update existing
        staffList[existingIndex] = { id, name, role, tabc, fhc };
    } else {
        // Create new
        staffList.push({ id, name, role, tabc, fhc });
    }

    localStorage.setItem('pericos_compliance', JSON.stringify(staffList));
    closeAddModal();
    renderTable();
});

// Edit existing record
function editStaff(id) {
    const staff = staffList.find(s => s.id === id);
    if (!staff) return;
    
    document.getElementById('staff-id').value = staff.id;
    document.getElementById('name-input').value = staff.name;
    document.getElementById('role-input').value = staff.role;
    document.getElementById('tabc-input').value = staff.tabc;
    document.getElementById('fhc-input').value = staff.fhc;
    
    document.getElementById('modal-title').innerText = 'Edit Staff Member';
    document.getElementById('staff-modal').classList.remove('hidden');
}

// Delete record
function deleteStaff(id) {
    if (confirm('Are you sure you want to remove this employee from the tracker?')) {
        staffList = staffList.filter(s => s.id !== id);
        localStorage.setItem('pericos_compliance', JSON.stringify(staffList));
        renderTable();
    }
}

// Live Search Listener
document.getElementById('search-staff').addEventListener('input', (e) => {
    renderTable(e.target.value);
});

// Initial Render on Page Load
document.addEventListener('DOMContentLoaded', () => {
    renderTable();
});
