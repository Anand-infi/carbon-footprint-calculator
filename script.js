// Get references to the HTML elements
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

// Function to handle the login attempt
function handleLogin(e) {
    e.preventDefault(); 
    errorMessage.textContent = ''; 

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        errorMessage.textContent = 'Please enter both email and password.';
        return;
    }

    // Use Firebase Authentication to sign in the user
    // NOTE: 'auth' and 'db' must be initialized in index.html for this to work
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            db.collection("users").doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const role = doc.data().role;

                        if (role === 'admin') {
                            window.location.href = 'admin.html';
                        } else if (role === 'client') {
                            window.location.href = 'client.html';
                        } else {
                            errorMessage.textContent = 'Login successful, but user role is not defined.';
                            auth.signOut();
                        }
                    } else {
                        errorMessage.textContent = 'User profile not found.';
                        auth.signOut();
                    }
                })
                .catch((error) => {
                    errorMessage.textContent = 'Error verifying role. Please try again.';
                    auth.signOut();
                });
            
        })
        .catch((error) => {
            const errorCode = error.code;
            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                errorMessage.textContent = 'Invalid email or password.';
            } else {
                errorMessage.textContent = `Error: ${error.message}`;
            }
        });
}

// Attach the login function to the button click event
loginBtn.addEventListener('click', handleLogin);
