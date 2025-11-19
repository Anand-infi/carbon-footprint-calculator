// --- Element References ---
const logoutBtn = document.getElementById('logout-btn');
const addFactorForm = document.getElementById('add-factor-form');
const factorsList = document.getElementById('factors-list');
const addClientForm = document.getElementById('add-client-form');
const clientMessage = document.getElementById('client-message');
const clientsList = document.getElementById('clients-list');
const moduleFactorsList = document.getElementById('module-factors-list');
const addModuleForm = document.getElementById('add-module-form');
const modulesList = document.getElementById('modules-list');
const submissionNotificationList = document.getElementById('submission-notification-list');
const auditDetailsArea = document.getElementById('audit-details-area');
const moduleSelector = document.getElementById('module-selector');

let globalEmissionFactors = []; // Array to store factors for Module creation

// --- Utility Functions ---

function openTab(evt, tabName) {
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

// --- Initialization and Auth Check ---

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
        loadSubmissions(); // Load the new audit list
    });
});

// --- Event Listeners ---

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => { window.location.href = 'index.html'; });
});

addFactorForm.addEventListener('submit', handleAddFactor);
addModuleForm.addEventListener('submit', handleAddModule);
addClientForm.addEventListener('submit', handleAddClient);


// ----------------------------------------------------
// 1. Emission Factor Management (CRUD)
// ----------------------------------------------------

function handleAddFactor(e) {
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
    factorsList.innerHTML = '';
    globalEmissionFactors = [];
    
    db.collection('emission_factors').orderBy('name', 'asc').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const factor = { ...doc.data(), id: doc.id };
                globalEmissionFactors.push(factor);

                const listItem = document.createElement('li');
                listItem.textContent = `[S${factor.scope}] ${factor.name} (${factor.value} kg CO2e / ${factor.unit})`;
                factorsList.appendChild(listItem);
            });
            // After loading factors, refresh the Module creator form
            renderModuleFactorCheckboxes();
        });
}

// ----------------------------------------------------
// 2. Module Management (New)
// ----------------------------------------------------

function renderModuleFactorCheckboxes() {
    moduleFactorsList.innerHTML = '';
    globalEmissionFactors.forEach(factor => {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="checkbox" id="check-${factor.id}" value="${factor.key}" data-factor-id="${factor.id}">
            <label for="check-${factor.id}">[S${factor.scope}] ${factor.name}</label>
        `;
        moduleFactorsList.appendChild(div);
    });
}

function handleAddModule(e) {
    e.preventDefault();
    const moduleId = document.getElementById('module-id').value;
    const selectedFactors = [];
    
    // Collect all checked factors
    document.querySelectorAll('#module-factors-list input:checked').forEach(checkbox => {
        const factor = globalEmissionFactors.find(f => f.key === checkbox.value);
        if (factor) {
            selectedFactors.push({
                key: factor.key,
                name: factor.name,
                unit: factor.unit
            });
        }
    });

    db.collection('modules').doc(moduleId).set({
        name: moduleId,
        factors: selectedFactors,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert(`Module "${moduleId}" saved with ${selectedFactors.length} factors.`);
        addModuleForm.reset();
        loadModules();
    });
}

function loadModules() {
    modulesList.innerHTML = '';
    moduleSelector.innerHTML = '<option value="" disabled selected>Select a Module</option>';
    
    db.collection('modules').orderBy('name', 'asc').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const module = doc.data();
                const listItem = document.createElement('li');
                listItem.textContent = `${module.name} (${module.factors.length} factors)`;
                modulesList.appendChild(listItem);
                
                // Populate the selector for Client Assignment
                const option = document.createElement('option');
                option.value = module.name;
                option.textContent = module.name;
                moduleSelector.appendChild(option);
            });
        });
}

// ----------------------------------------------------
// 3. Client Management
// ----------------------------------------------------

function handleAddClient(e) {
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
                hasNewSubmission: false, // Notification field
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
    clientsList.innerHTML = '';
    db.collection('users')
        .where('role', '==', 'client')
        .orderBy('organizationName', 'asc')
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const client = doc.data();
                const listItem = document.createElement('li');
                listItem.textContent = `${client.organizationName} (Module: ${client.reportingModule})`;
                clientsList.appendChild(listItem);
            });
        });
}

// ----------------------------------------------------
// 4. Audit & Report Workflow (New)
// ----------------------------------------------------

// Function to handle the "PING" notification logic
function loadSubmissions() {
    submissionNotificationList.innerHTML = '';
    auditDetailsArea.innerHTML = '<p>Select a submission above to view details.</p>';

    // Look for new submissions and submissions needing re-entry
    db.collection('submissions')
        .where('status', 'in', ['Pending Review', 'Rejected'])
        .orderBy('timestamp', 'desc')
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const submission = doc.data();
                const date = submission.timestamp ? submission.timestamp.toDate().toLocaleDateString() : 'N/A';
                const statusClass = submission.status === 'Rejected' ? 'rejected' : 'pending';

                const listItem = document.createElement('li');
                listItem.classList.add(statusClass);
                listItem.textContent = `${submission.organizationName} - ${date} (${submission.status})`;
                listItem.dataset.submissionId = doc.id;
                listItem.addEventListener('click', () => displayAuditDetails(doc.id, submission));
                submissionNotificationList.appendChild(listItem);
            });
        });
}

function displayAuditDetails(submissionId, submission) {
    // 1. Display Details and Factors
    auditDetailsArea.innerHTML = `
        <h3>Submission by: ${submission.organizationName}</h3>
        <p>Date: ${submission.timestamp.toDate().toLocaleString()}</p>
        <p>Module: ${submission.module}</p>
        <p>Current Status: <strong>${submission.status}</strong></p>
        
        <h4>Data Entries:</h4>
        <form id="audit-form-${submissionId}">
            <input type="hidden" name="submissionId" value="${submissionId}">
            <ul>
                ${Object.keys(submission.entries).map(key => `
                    <li>
                        <strong>${submission.entries[key].name}:</strong> ${submission.entries[key].activity} ${submission.entries[key].unit}
                        <br>
                        <label>
                            <input type="radio" name="status_${key}" value="correct" ${submission.entries[key].reviewStatus !== 'rejected' ? 'checked' : ''}> Correct
                        </label>
                        <label>
                            <input type="radio" name="status_${key}" value="wrong"> Wrong
                        </label>
                        <input type="text" name="comment_${key}" placeholder="Comment for Client (if wrong)" value="${submission.entries[key].adminComment || ''}">
                    </li>
                `).join('')}
            </ul>
            <button type="button" onclick="handleAuditReview('${submissionId}', 'verify')">Verify & Calculate</button>
            <button type="button" onclick="handleAuditReview('${submissionId}', 'reject')">Reject Entries & Comment</button>
        </form>
    `;
    
    // Add styling for rejected status (optional, you can add this to style.css)
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `.rejected { color: red; font-weight: bold; } .pending { color: orange; }`;
    document.head.appendChild(styleTag);
}


function handleAuditReview(submissionId, action) {
    const form = document.getElementById(`audit-form-${submissionId}`);
    const updates = {};
    let allCorrect = true;

    // Iterate through all entries to collect review status and comments
    Object.keys(submission.entries).forEach(key => {
        const reviewStatus = form.querySelector(`input[name="status_${key}"]:checked`).value;
        const adminComment = form.querySelector(`input[name="comment_${key}"]`).value;

        updates[`entries.${key}.reviewStatus`] = reviewStatus;
        updates[`entries.${key}.adminComment`] = reviewComment;

        if (reviewStatus === 'wrong') {
            allCorrect = false;
        }
    });

    if (action === 'reject' || !allCorrect) {
        // REJECT Workflow
        updates.status = 'Rejected';
        db.collection('submissions').doc(submissionId).update(updates)
            .then(() => {
                alert('Submission rejected. Client notified to re-enter data.');
                loadSubmissions();
            });
    } else if (action === 'verify' && allCorrect) {
        // VERIFY & CALCULATE Workflow
        
        // 1. Calculate final footprint based on verified data and current factors
        let finalFootprint = 0;
        const entries = submission.entries;
        
        db.collection('emission_factors').get().then(factorSnapshot => {
            let currentFactors = {};
            factorSnapshot.forEach(doc => {
                 const factor = doc.data();
                 currentFactors[factor.key] = factor.value; // Map key to value
            });
            
            Object.keys(entries).forEach(key => {
                const entry = entries[key];
                const factorValue = currentFactors[key]; // Use current factor from DB
                
                if (factorValue) {
                    finalFootprint += entry.activity * factorValue;
                }
            });

            // 2. Update Submission Document
            updates.status = 'Approved';
            updates.finalFootprint = finalFootprint;
            updates.verifiedAt = firebase.firestore.FieldValue.serverTimestamp();
            
            db.collection('submissions').doc(submissionId).update(updates)
                .then(() => {
                    alert(`Submission approved. Final Footprint: ${finalFootprint.toFixed(2)} kg CO2e. Results now visible to Client.`);
                    loadSubmissions(); // Refresh the list
                });
        });
    }
}
