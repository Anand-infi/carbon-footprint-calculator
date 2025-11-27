// --- Element References (ADD NEW DROPDOWN IDS) ---
const logoutBtn = document.getElementById('logout-btn');
const addFactorForm = document.getElementById('add-factor-form');
const factorsDropdown = document.getElementById('factors-dropdown'); // NEW
const selectedFactorDetails = document.getElementById('selected-factor-details'); // NEW
const addClientForm = document.getElementById('add-client-form');
const clientMessage = document.getElementById('client-message');
const clientsDropdown = document.getElementById('clients-dropdown'); // NEW
const selectedClientDetails = document.getElementById('selected-client-details'); // NEW
const moduleFactorsList = document.getElementById('module-factors-list');
const addModuleForm = document.getElementById('add-module-form');
const modulesList = document.getElementById('modules-list');
const submissionNotificationList = document.getElementById('submission-notification-list');
const auditDetailsArea = document.getElementById('audit-details-area');
const moduleSelector = document.getElementById('module-selector');

let globalEmissionFactors = []; // Array to store factors for Module creation
let globalClients = {}; // Object to store client data for details view

// --- Utility Functions (Keep as is) ---
function openTab(evt, tabName) {
    // ... (Keep the tab switching logic) ...
    var tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active-content");
    }
    var tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    document.getElementById(tabName).classList.add("active-content");
    evt.currentTarget.className += " active";
}

// --- Initialization and Auth Check (Keep as is) ---
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        } 
        document.getElementById('Factors').style.display = 'block';
        loadEmissionFactors();
        loadModules();
        loadClients();
        loadSubmissions();
    });

    // Add event listeners for new dropdowns
    factorsDropdown.addEventListener('change', displayFactorDetails);
    clientsDropdown.addEventListener('change', displayClientDetails);
});

// --- Event Listeners (Keep existing, add new dropdown listeners) ---
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => { window.location.href = 'index.html'; });
});
addFactorForm.addEventListener('submit', handleAddFactor);
addModuleForm.addEventListener('submit', handleAddModule);
addClientForm.addEventListener('submit', handleAddClient);


// ----------------------------------------------------
// 1. Emission Factor Management (Dropdown Update)
// ----------------------------------------------------

function handleAddFactor(e) {
    // ... (Keep the same logic for adding the factor) ...
    e.preventDefault();
    const name = document.getElementById('factor-name').value;
    const scope = document.getElementById('factor-scope').value;
    const value = parseFloat(document.getElementById('factor-value').value);
    const unit = document.getElementById('factor-unit').value;
    
    db.collection('emission_factors').add({
        name: name, scope: scope, value: value, unit: unit,
        key: name.replace(/\s/g, '_') + '_S' + scope, // Create unique key for module assignment
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert('Emission Factor added successfully!');
        addFactorForm.reset();
        loadEmissionFactors();
    });
}

function loadEmissionFactors() {
    factorsDropdown.innerHTML = '<option value="" disabled selected>Select a Factor to View Details</option>';
    globalEmissionFactors = [];
    
    db.collection('emission_factors').orderBy('name', 'asc').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const factor = { ...doc.data(), id: doc.id };
                globalEmissionFactors.push(factor);

                // Populate the dropdown
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `[S${factor.scope}] ${factor.name} (${factor.unit})`;
                factorsDropdown.appendChild(option);
            });
            renderModuleFactorCheckboxes();
        });
}

function displayFactorDetails() {
    const factorId = factorsDropdown.value;
    const factor = globalEmissionFactors.find(f => f.id === factorId);

    if (factor) {
        selectedFactorDetails.innerHTML = `
            <h4>${factor.name}</h4>
            <p><strong>Scope:</strong> ${factor.scope}</p>
            <p><strong>Emission Value:</strong> ${factor.value} kg $\text{CO}_2\text{e}$ / ${factor.unit}</p>
            <p><strong>Unique Key:</strong> ${factor.key}</p>
        `;
    } else {
        selectedFactorDetails.innerHTML = '<p>Select a factor above.</p>';
    }
}

// ----------------------------------------------------
// 2. Module Management (Keep as is)
// ----------------------------------------------------
// ... (Keep renderModuleFactorCheckboxes, handleAddModule, loadModules functions as they were) ...

// ----------------------------------------------------
// 3. Client Management (Dropdown Update)
// ----------------------------------------------------

function handleAddClient(e) {
    // ... (Keep the same logic for adding the client) ...
    e.preventDefault();
    clientMessage.textContent = ''; 

    const orgName = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const password = document.getElementById('client-password').value;
    const module = document.getElementById('module-selector').value;

    if (!module) {
        clientMessage.textContent = 'Please select a reporting module.';
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            return db.collection('users').doc(user.uid).set({
                role: 'client',
                organizationName: orgName,
                reportingModule: module,
                logoUrl: '', // New field for logo URL
                hasNewSubmission: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            clientMessage.textContent = `Client "${orgName}" created successfully! Module: ${module}.`;
            clientMessage.style.color = 'green';
            addClientForm.reset();
            loadClients();
        })
        .catch((error) => {
            clientMessage.textContent = `Error creating client: ${error.message}`;
            clientMessage.style.color = 'red';
        });
}

function loadClients() {
    clientsDropdown.innerHTML = '<option value="" disabled selected>Select a Client to View Details</option>';
    globalClients = {};

    db.collection('users')
        .where('role', '==', 'client')
        .orderBy('organizationName', 'asc')
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const client = { ...doc.data(), id: doc.id };
                globalClients[doc.id] = client;

                // Populate the dropdown
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${client.organizationName} (Module: ${client.reportingModule})`;
                clientsDropdown.appendChild(option);
            });
        });
}

function displayClientDetails() {
    const clientId = clientsDropdown.value;
    const client = globalClients[clientId];

    if (client) {
        selectedClientDetails.innerHTML = `
            <h4>${client.organizationName}</h4>
            <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
            <p><strong>Reporting Module:</strong> ${client.reportingModule}</p>
            <p><strong>Logo Status:</strong> ${client.logoUrl ? 'Uploaded' : 'None'}</p>
            <p><strong>First Submission:</strong> ${client.hasNewSubmission ? 'Yes (Check Audit Tab)' : 'No'}</p>
        `;
    } else {
        selectedClientDetails.innerHTML = '<p>Select a client above.</p>';
    }
}

// ----------------------------------------------------
// 4. Audit & Report Workflow (Keep as is)
// ... (Keep loadSubmissions, displayAuditDetails, and handleAuditReview functions as they were) ...
