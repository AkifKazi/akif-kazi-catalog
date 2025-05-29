// Placeholder for staff.js
// Logic for staff dashboard, activity log viewing, item status updates.

document.addEventListener('DOMContentLoaded', () => {
    const staffNameElement = document.getElementById('staffName');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (currentUser && staffNameElement) {
        staffNameElement.textContent = currentUser.UserName;
    }
});
