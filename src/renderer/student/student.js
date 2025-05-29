// Placeholder for student.js
// Logic for student dashboard, item browsing, borrowing.

document.addEventListener('DOMContentLoaded', () => {
    const studentNameElement = document.getElementById('studentName');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (currentUser && studentNameElement) {
        studentNameElement.textContent = currentUser.UserName;
    }
});
