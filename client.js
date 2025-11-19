// Global variables
let emissionFactors = {};
let currentUserData = {};
let currentSubmission = null; // Stores the latest submission data

// Element References
const logoutBtn = document.getElementById('logout-btn');
const reportsList = document.getElementById('reports-list');
const dynamicInputs = document.getElementById('dynamic-inputs');
const submitDataBtn = document.getElementById('submit-data-btn');
const clientMessage = document.getElementById('client-message');
const calculationResult = document.getElementById('calculation-result');
const reportingFormContainer = document.getElementById('reporting-form-container');
const moduleDisplay = document.getElementById('module-display');

// Event Listeners
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => { window.location.href = 'index.html'; });
});
document.getElementById('carbon-data-form').addEventListener('submit', handleSubmission);

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        } 
        // 1. Fetch User Data (Role and Module)
        db.collection("users").doc(user.uid).get()
            .then((doc) => {
                if (doc.exists && doc.data().role === 'client') {
                    currentUserData = doc.data();
                    document.getElementById('welcome-message').textContent = `${currentUserData.organizationName} Portal`;
                    moduleDisplay.textContent = currentUserData.reportingModule;

                    // 2. Load Factors and Check Submission Status
                    loadEmissionFactors().then(() => {
                        checkSubmissionStatus(user.uid);
                    });
                } else {
                    alert('Access Denied: Not a valid Client role.');
                    auth.signOut();
                }
            });
    });
});

// --- Core Workflow Logic ---

function loadEmissionFactors() {
    return db.collection('emission_factors').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const factor = doc.data();
                // Key matches admin logic: name_Sscope
                const key = factor.name.replace(/\s/g, '_') + '_S' + factor.scope;
                emissionFactors[key] = factor;
            });
        });
}

function checkSubmissionStatus(userId) {
    // Get the most recent submission
    db.collection('submissions')
        .where('organizationId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then((snapshot) => {
            if (!snapshot.empty) {
                currentSubmission = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id };
            }
            
            // Handle display based on status
            if (!currentSubmission || currentSubmission.status === 'Rejected' || currentSubmission.status === 'Approved') {
                // Allow form entry if first time, rejected, or after a report is approved
                generateForm(currentUserData.reportingModule, currentSubmission);
                if (currentSubmission && currentSubmission.status === 'Approved') {
                    displayApprovedReport(currentSubmission);
                }
            } else if (currentSubmission.status === 'Pending Review') {
                // LOCK the form if Admin hasn't reviewed it yet
                reportingFormContainer.innerHTML = `
                    <p style="color: orange; font-weight: bold;">
                        Your submission from ${currentSubmission.timestamp.toDate().toLocaleDateString()} is currently pending Admin review.
                        Please wait for verification before submitting new data.
                    </p>
                `;
            }
            loadHistoricalReports(userId);
        });
}


function generateForm(moduleName, latestSubmission) {
    dynamicInputs.innerHTML = ''; 
    const isRejected = latestSubmission && latestSubmission.status === 'Rejected';
    const formTitle = isRejected ? 'Re-entry Required' : 'New Data Submission';
    
    clientMessage.textContent = isRejected ? 'Some fields were marked wrong by the Admin. Please review comments and re-enter data.' : '';
    clientMessage.style.color = 'red';

    // 1. Fetch Module factors
    db.collection('modules').doc(moduleName).get().then(doc => {
        if (!doc.exists) {
            dynamicInputs.innerHTML = `<p style="color: red;">Error: Assigned module "${moduleName}" not found.</p>`;
            return;
        }
        
        const module = doc.data();
        module.factors.forEach(factorDef => {
            const factorKey = factorDef.key;
            const factor = emissionFactors[factorKey]; // Get full factor details (unit, value)

            // Get previous data/comment if rejected
            const previousEntry = isRejected ? latestSubmission.entries[factorKey] : {};

            if (factor) {
                const div = document.createElement('div');
                div.classList.add('input-group');
                
                // Show rejection status and comment
                if (isRejected && previousEntry.reviewStatus === 'wrong') {
                    div.innerHTML += `<p style="color: red; font-size: 0.9em;">
                        **REJECTED:** ${previousEntry.adminComment || 'No comment provided.'}
                    </p>`;
                }

                div.innerHTML += `
                    <label for="${factorKey}">${factorDef.name} (Unit: ${factor.unit}):</label>
                    <input type="number" id="${factorKey}" data-factor-key="${factorKey}" step="any" required
                           value="${previousEntry.activity || ''}">
                `;
                dynamicInputs.appendChild(div);
            }
        });
        submitDataBtn.disabled = false;
    });
}

function handleSubmission(e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('#dynamic-inputs input[type="number"]');
    let submissionData = {
        organizationId: auth.currentUser.uid,
        organizationName: currentUserData.organizationName,
        module: currentUserData.reportingModule,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'Pending Review', // Set initial status
        entries: {}
    };

    inputs.forEach(input => {
        const activityData = parseFloat(input.value);
        const factorKey = input.dataset.factorKey;
        const factor = emissionFactors[factorKey];

        if (activityData >= 0 && factor) {
            submissionData.entries[factorKey] = {
                activity: activityData,
                unit: factor.unit,
                name: factor.name,
                // Initial review status is correct, Admin must flag it as wrong later
                reviewStatus: 'correct' 
            };
        }
    });
    
    // If re-submitting after rejection, delete the old submission
    const oldSubmissionId = currentSubmission && currentSubmission.status === 'Rejected' ? currentSubmission.id : null;

    db.collection('submissions').add(submissionData)
        .then(() => {
            if (oldSubmissionId) {
                return db.collection('submissions').doc(oldSubmissionId).delete();
            }
        })
        .then(() => {
            alert('Data submitted for Admin review. Calculation will appear after verification.');
            document.getElementById('carbon-data-form').reset();
            checkSubmissionStatus(auth.currentUser.uid); // Lock the form
        })
        .catch(error => {
            console.error("Error submitting data:", error);
            alert('Error submitting data: ' + error.message);
        });
}

function displayApprovedReport(report) {
    calculationResult.innerHTML = `
        <h3 style="color: #2ecc71;">✅ Verified Carbon Footprint</h3>
        <p>Verified on: ${report.verifiedAt.toDate().toLocaleDateString()}</p>
        <p style="font-size: 1.5em; font-weight: bold;">
            Total $\text{CO}_2\text{e}$: ${report.finalFootprint.toFixed(2)} kg
        </p>
    `;
}

function loadHistoricalReports(userId) {
    reportsList.innerHTML = '';
    // Load ALL reports, including Rejected and Pending, for history
    db.collection('submissions')
        .where('organizationId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(10) 
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const report = doc.data();
                const date = report.timestamp ? report.timestamp.toDate().toLocaleDateString() : 'N/A';
                const statusColor = report.status === 'Approved' ? '#2ecc71' : report.status === 'Rejected' ? 'red' : 'orange';
                
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    Report Date: ${date} | Status: <strong style="color: ${statusColor};">${report.status}</strong>
                    ${report.status === 'Approved' ? `| Total: ${report.finalFootprint.toFixed(2)} kg $\text{CO}_2\text{e}$` : ''}
                `;
                reportsList.appendChild(listItem);
            });
        });
}
