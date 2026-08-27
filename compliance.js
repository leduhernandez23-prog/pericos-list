// --- SECURITY & USER AUTHENTICATION ---
let activeUser = localStorage.getItem('pericos_active_user');
let activeRole = localStorage.getItem('pericos_active_role');
let currentLocation = localStorage.getItem('pericos_location');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Kick out unauthorized users back to the login screen
    if (!activeUser) {
        // Option 3 behavior: direct redirect, not confirm.
        window.location.href = 'index.html';
        return;
    }

    // 2. Display User Info in Header
    document.getElementById('user-display-name').innerText = activeUser;
    
    if (activeRole === 'Owner') {
        document.getElementById('user-display-role').innerText = 'Owner Access';
    } else {
        let displayLoc = currentLocation ? currentLocation.replace('LP_', '') : '';
        document.getElementById('user-display-role').innerText = `${activeRole} • ${displayLoc}`;
    }

    // 3. Load the table data
    renderTable();
});


// --- COMPLIANCE TRACKER LOGIC ---

// Data refined for Hospitality Manager ( restricted roles, integrated phone numbers )
let staffList = JSON.parse(localStorage.getItem('pericos_compliance')) || [
    { id: '1', name: 'Example Host', role: 'Host', phone: '(936) 555-0123', tabc: '2026-10-15', fhc: '2027-05-20' },
    { id: '2', name: 'Example Server', role: 'Server', phone: '(936) 555-9876', tabc: '2026-09-01', fhc: '2026-08-10' },
    { id: '3', name: 'Example Kitchen', role: 'Kitchen', phone: '(936) 555-1122', tabc: '2026-08-25', fhc: '2027-01-10' }
];

// Option 3 Badge Generator: Streamlined text badges with integrated icon
function getStatusBadge(dateString) {
    if (!dateString) return '<span class="text-slate-400 italic">N/A</span>';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const expDate = new Date(dateString);
    expDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        // Expired ( Rose Icon )
        return `<span class="badge-hospitality badge-expired-h"><i class="fa-solid fa-circle-xmark mr-1.5"></i> Expired (${dateString})</span>`;
    } else if (diffDays <= 30) {
        // Soon ( Deep Yellow Icon )
        return `<span class="badge-hospitality badge-soon-h"><i class="fa-solid fa-clock mr-1.5"></i> Soon (${dateString})</span>`;
    } else {
        // Valid ( Deep Green Icon )
        return `<span class="badge-hospitality badge-valid-h"><i class="fa-solid fa-circle-check mr-1.5"></i> Valid (${dateString})</span>`;
    }
}

// Option 3 Table Renderer: Focused on columns, phone, and warm hover
function renderTable(filter = '') {
    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '';
    
    let total = staffList.length;
    let expiring = 0;
    let expired = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Option 3 Search Filter: Allows searching by name, role, or phone number
    const filtered = staffList.filter(s => 
        s.name.toLowerCase().includes(filter.toLowerCase()) || 
        s.role.toLowerCase().includes(filter.toLowerCase()) ||
        (s.phone && s.phone.includes(filter)) // allows searching with phone parenthesis/hyphens
    );

    filtered.forEach(staff => {
        // Calculate total alerts across all active staff
        [staff.tabc, staff.fhc].forEach(dateString => {
            if (dateString) {
                const expDate = new Date(dateString);
                expDate.setHours(0,0,0,0);
                const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) expired++;
                else if (diffDays <= 30) expiring++;
            }
        });

        // Ensure data saved before phone field was added still displays correctly
        const phoneDisplay = staff.phone ? staff.phone : '<span class="italic text-slate-400">N/A</span>';

        const tr = document.createElement('tr');
        // cursor-default ensures standard behavior, hover is soft warm (bg-stone-50)
        tr.className = "hover:bg-slate-50 transition cursor-default"; 
        
        // Exact 6 columns output to match HTML headers
        tr.innerHTML = `
            <td class="py-4 px-6 font-semibold text-slate-800">${staff.name}</td>
            <td class="py-4 px-6 text-slate-500">${staff.role}</td>
            <td class="py-4 px-6 text-slate-500">${phoneDisplay}</td>
            <td class="py-4 px-6">${getStatusBadge(staff.tabc)}</td>
            <td class="py-4 px-6">${getStatusBadge(staff.fhc)}</td>
            <td class="py-4 px-6 text-right space-x-3.5">
                <button onclick="editStaff('${staff.id}')" class="text-slate-400 hover:text-emerald-700 transition" title="Edit Employee"><i class="fa-solid fa-pen-to-square text-lg"></i></button>
                <button onclick="deleteStaff('${staff.id}')" class="text-slate-400 hover:text-rose-600 transition" title="Remove Employee"><i class="fa-solid fa-trash text-lg"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update DOM stats (Option 3 sophisticated display)
    document.getElementById('total-staff').innerText = total;
    document.getElementById('expiring-soon').innerText = expiring;
    document.getElementById('expired-count').innerText = expired;
}

// Modal Controls
function openAddModal() {
    document.getElementById('staff-id').value = '';
    document.getElementById('staff-form').reset();
    document.getElementById('modal-title').innerText = 'Add New Staff Member';
    
    const modal = document.getElementById('staff-modal');
    modal.classList.remove('hidden');
    // For Option 3 smooth pop-in animation
    setTimeout(() => {
        modal.querySelector('.hospitality-modal').classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function closeAddModal() {
    const modal = document.getElementById('staff-modal');
    modal.querySelector('.hospitality-modal').classList.add('scale-95', 'opacity-0');
    // Hide modal after animation completes
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Save or Update Record
document.getElementById('staff-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const id = document.getElementById('staff-id').value || Date.now().toString();
    const name = document.getElementById('name-input').value;
    const role = document.getElementById('role-input').value;
    const phone = document.getElementById('phone-input').value; // integrated phone number
    const tabc = document.getElementById('tabc-input').value;
    const fhc = document.getElementById('fhc-input').value;

    const existingIndex = staffList.findIndex(s => s.id === id);
    if (existingIndex > -1) {
        // Update existing
        staffList[existingIndex] = { id, name, role, phone, tabc, fhc };
    } else {
        // Create new
        staffList.push({ id, name, role, phone, tabc, fhc });
    }

    // Save to Option 3 local behavior
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
    document.getElementById('phone-input').value = staff.phone || ''; // ensured phone displays
    document.getElementById('tabc-input').value = staff.tabc;
    document.getElementById('fhc-input').value = staff.fhc;
    
    document.getElementById('modal-title').innerText = 'Edit Employee Record';
    const modal = document.getElementById('staff-modal');
    modal.classList.remove('hidden');
    // Smooth Option 3 pop-in animation
    setTimeout(() => {
        modal.querySelector('.hospitality-modal').classList.remove('scale-95', 'opacity-0');
    }, 10);
}

// Delete record
function deleteStaff(id) {
    // Option 3 specific behavior: simplified confirm text
    if (confirm('Are you sure you want to securely remove this employee record from the tracker?')) {
        staffList = staffList.filter(s => s.id !== id);
        localStorage.setItem('pericos_compliance', JSON.stringify(staffList));
        renderTable();
    }
}

// Live Search Listener (name, role, or phone number)
document.getElementById('search-staff').addEventListener('input', (e) => {
    renderTable(e.target.value);
});
