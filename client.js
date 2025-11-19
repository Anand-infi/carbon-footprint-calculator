// Global variables to store factors and user data
let emissionFactors = {};
let currentUserData = {};

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout error:", error);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authorization Check
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html'; // Redirect if not logged in
            return;
        } 

        // 2. Fetch User Data (Role and Module)
        db.collection("users").doc(user.uid).get()
            .then((doc) => {
                if (doc.exists && doc.data().role === 'client') {
                    currentUserData = doc.data();
                    document.getElementById('welcome-message').textContent = `${currentUserData.organizationName} Portal`;
                    document.getElementById('module-display').textContent = currentUserData.reportingModule;

                    // 3. Load Factors and Generate Form
                    loadEmissionFactors().then(() => {
                        generateForm(currentUserData.reportingModule);
                        loadHistoricalReports(user.uid);
                    });
                } else {
                    alert('Access Denied: Not a valid Client role.');
                    auth.signOut();
                }
            })
            .catch(error => {
                console.error("Error loading user data:", error);
                auth.signOut();
            });
    });
});


// ----------------------------------------------------
// 1. Factor Retrieval Logic
// ----------------------------------------------------

function loadEmissionFactors() {
    return db.collection('emission_factors').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const factor = doc.data();
                // Store factors keyed by a unique ID (e.g., name_scope_unit)
                const key = `${factor.name.replace(/\s/g, '_')}_S${factor.scope}`;
                emissionFactors[key] = factor;
            });
            console.log("Factors loaded:", emissionFactors);
        })
        .catch((error) => {
            console.error("Error loading factors:", error);
        });
}


// ----------------------------------------------------
// 2. Dynamic Form Generation (Based on Module)
// ----------------------------------------------------

function generateForm(module) {
    const dynamicInputs = document.getElementById('dynamic-inputs');
    dynamicInputs.innerHTML = ''; // Clear loading message

    // Define module requirements based on the module string
    let requiredInputs = [];
    if (module === 'Basic_S1_S2') {
        requiredInputs = [
            // { factorKey: unique_key_from_admin, label: "User friendly prompt" }
            { factorKey: 'Grid_Electricity_S2', label: "Total Electricity Consumption (kWh)" },
            { factorKey: 'Diesel_Vehicle_S1', label: "Liters of Diesel Used in Company Vehicles" }
        ];
    } else if (module === 'Full_All_Scopes') {
        requiredInputs = [
            { factorKey: 'Grid_Electricity_S2', label: "Total Electricity Consumption (kWh)" },
            { factorKey: 'Diesel_Vehicle_S1', label: "Liters of Diesel Used in Company Vehicles" },
            { factorKey: 'Business_Flights_S3', label: "Total km of Business Flights" }
        ];
    }

    requiredInputs.forEach(inputDef => {
        // Check if the required factor actually exists in our loaded data
        const factor = emissionFactors[inputDef.factorKey];
        if (factor) {
            const div = document.createElement('div');
            div.innerHTML = `
                <label for="${inputDef.factorKey}">${inputDef.label} (Unit: ${factor.unit}):</label>
                <input type="number" id="${inputDef.factorKey}" data-factor-key="${inputDef.factorKey}" step="any" required>
            `;
            dynamicInputs.appendChild(div);
        } else {
            // Error handling if Admin defined a module with a missing factor
            console.warn(`Factor key ${inputDef.factorKey} is missing from emission factors.`);
            const p = document.createElement('p');
            p.textContent = `Warning: Missing factor for ${inputDef.label}.`;
            dynamicInputs.appendChild(p);
        }
    });

    document.getElementById('submit-data-btn').disabled = false; // Enable button once form is built
}


// ----------------------------------------------------
// 3. Calculation and Submission Logic
// ----------------------------------------------------

document.getElementById('carbon-data-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = document.querySelectorAll('#dynamic-inputs input[type="number"]');
    let totalFootprint = 0;
    let submissionData = {
        organizationId: auth.currentUser.uid,
        organizationName: currentUserData.organizationName,
        module: currentUserData.reportingModule,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        entries: {}
    };

    inputs.forEach(input => {
        const activityData = parseFloat(input.value);
        const factorKey = input.dataset.factorKey;
        const factor = emissionFactors[factorKey];

        if (activityData >= 0 && factor) {
            const emission = activityData * factor.value;
            totalFootprint += emission;
            
            // Store details of the entry
            submissionData.entries[factorKey] = {
                activity: activityData,
                factorValue: factor.value,
                emission: emission,
                unit: factor.unit
            };
        }
    });

    submissionData.totalFootprint = totalFootprint;
    const resultDisplay = document.getElementById('calculation-result');
    resultDisplay.textContent = `Calculated Footprint: ${totalFootprint.toFixed(2)} kg CO2e`;
    
    // Save the submission to a new 'submissions' collection
    db.collection('submissions').add(submissionData)
        .then(() => {
            alert('Data submitted successfully! Total Footprint: ' + totalFootprint.toFixed(2) + ' kg CO2e');
            document.getElementById('carbon-data-form').reset();
            loadHistoricalReports(auth.currentUser.uid); // Refresh reports
        })
        .catch(error => {
            console.error("Error submitting data:", error);
            alert('Error submitting data: ' + error.message);
        });
});

// ----------------------------------------------------
// 4. Historical Reports Loading
// ----------------------------------------------------

function loadHistoricalReports(userId) {
    const reportsList = document.getElementById('reports-list');
    reportsList.innerHTML = '';

    db.collection('submissions')
        .where('organizationId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(10) // Show last 10 reports
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const report = doc.data();
                const date = report.timestamp ? report.timestamp.toDate().toLocaleDateString() : 'N/A';
                const listItem = document.createElement('li');
                listItem.textContent = `Report Date: ${date} - Total: ${report.totalFootprint.toFixed(2)} kg CO2e (${report.module})`;
                reportsList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error("Error loading reports:", error);
        });
}
