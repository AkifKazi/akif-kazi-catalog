// Placeholder for login.js
// Logic for handling login button click and IPC communication will go here.

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const passcodeField = document.getElementById('passcode');
    const errorMessageElement = document.getElementById('errorMessage');

    if (loginButton && passcodeField) {
        loginButton.addEventListener('click', async () => {
            const passcode = passcodeField.value;
            if (!passcode) {
                if(errorMessageElement) errorMessageElement.textContent = 'Passcode cannot be empty.';
                return;
            }
            try {
                const user = await window.electronAPI.login(passcode);
                if (user) {
                    // Store user details (e.g., in localStorage)
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    if(errorMessageElement) errorMessageElement.textContent = '';
                    
                    // Navigate based on role or passcode length convention
                    if (user.Role === 'Student' || passcode.length === 4) { // Example logic
                        window.location.href = '../student/student.html';
                    } else if (user.Role === 'Staff' || passcode.length === 6) { // Example logic
                        window.location.href = '../staff/staff.html';
                    } else {
                         if(errorMessageElement) errorMessageElement.textContent = 'Unknown user type for navigation.';
                    }
                } else {
                    if(errorMessageElement) errorMessageElement.textContent = 'Invalid passcode. Please try again.';
                }
            } catch (error) {
                console.error('Login error:', error);
                if(errorMessageElement) errorMessageElement.textContent = `Error: ${error.message || 'Login failed'}`;
            }
        });

        passcodeField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                loginButton.click();
            }
        });
    }
});
