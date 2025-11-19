// Function to handle tab switching (pure JavaScript for the UI)
function openTab(evt, tabName) {
    // Get all elements with class="tab-content" and hide them
    var tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active-content");
    }

    // Get all elements with class="tab-link" and remove the class "active"
    var tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    document.getElementById(tabName).classList.add("active-content");
    evt.currentTarget.className += " active";
}

// Set the default tab to be open
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and redirect if not
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        } 
        // We assume they are an Admin because they reached this page via the login check

        // Open the default tab (Factors)
        document.getElementById('Factors').style.display = 'block';
        
        // Load initial emission factors
        loadEmissionFactors();
    });
});

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout error:", error);
    });
});


// ----------------------------------------------------
// 1. Emission Factor Management Logic
// ----------------------------------------------------

const addFactorForm = document.getElementById('add-factor-form');
const factorsList = document.getElementById('factors-list');

// Function to save a new factor to Firestore
addFactorForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('factor-name').value;
    const scope = document.getElementById('factor-scope').value;
    const value = parseFloat(document.getElementById('factor-value').value);
    const unit = document.getElementById('factor-unit').value;

    db.collection('emission_factors').add({
        name: name,
        scope: scope,
        value: value,
        unit: unit,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Adds a time stamp
    })
    .then(() => {
        alert('Emission Factor added successfully!');
        addFactorForm.reset();
        loadEmissionFactors(); // Reload the list
    })
    .catch((error) => {
        console.error("Error adding document: ", error);
        alert('Error adding factor: ' + error.message);
    });
});

// Function to retrieve and display factors
function loadEmissionFactors() {
    factorsList.innerHTML = ''; // Clear existing list

    db.collection('emission_factors').orderBy('name', 'asc').get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const factor = doc.data();
                const listItem = document.createElement('li');
                listItem.textContent = `[Scope ${factor.scope}] ${factor.name}: ${factor.value} kg CO2e / ${factor.unit}`;
                factorsList.appendChild(listItem);
            });
        })
        .catch((error) => {
            console.error("Error loading factors: ", error);
            factorsList.innerHTML = '<li>Error loading data.</li>';
        });
}

// Add these variables at the top of admin.js with the other const declarations
const addClientForm = document.getElementById('add-client-form');
const clientMessage = document.getElementById('client-message');
const clientsList = document.getElementById('clients-list');

// ----------------------------------------------------
// 2. Client Management Logic
// ----------------------------------------------------

addClientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clientMessage.textContent = ''; // Clear previous messages

    const orgName = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const password = document.getElementById('client-password').value;
    const module = document.getElementById('module-selector').value;

    // STEP 1: Create the User in Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // STEP 2: Store the User's Role and Module in Firestore
            return db.collection('users').doc(user.uid).set({
                role: 'client', // Fixed role for all new clients
                organizationName: orgName,
                reportingModule: module, // e.g., 'Basic_S1_S2'
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Success
            clientMessage.textContent = `Client "${orgName}" created successfully! Module: ${module}.`;
            clientMessage.style.color = 'green';
            addClientForm.reset();
            loadClients(); // Reload the list of clients
        })
        .catch((error) => {
            // Handle errors from either Auth or Firestore creation
            clientMessage.textContent = `Error creating client: ${error.message}`;
            clientMessage.style.color = 'red';
            console.error("Client Creation Error:", error);
        });
});

// Function to retrieve and display existing clients
function loadClients() {
    clientsList.innerHTML = ''; // Clear existing list

    db.collection('users')
        .where('role', '==', 'client') // Only fetch documents where role is 'client'
        .orderBy('organizationName', 'asc')
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const client = doc.data();
                const listItem = document.createElement('li');
                listItem.textContent = `${client.organizationName} (${client.reportingModule})`;
                clientsList.appendChild(listItem);
            });
        })
        .catch((error) => {
            console.error("Error loading clients: ", error);
            clientsList.innerHTML = '<li>Error loading client data.</li>';
        });
}

// Add loadClients to run when the page loads (inside the DOMContentLoaded listener)
// Find this section in your admin.js:
/*
// Set the default tab to be open
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in... (code continues)
    auth.onAuthStateChanged(user => {
        if (!user) {
            // ...
        } 
        
        // Open the default tab (Factors)
        document.getElementById('Factors').style.display = 'block';
        
        // Load initial emission factors
        loadEmissionFactors();
        // ADD THIS LINE:
        loadClients(); 
    });
});
*/
