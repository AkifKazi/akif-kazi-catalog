const passcodeField = document.getElementById("passcode");

if (passcodeField) {
    passcodeField.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.keyCode === 13) {
            event.preventDefault(); 
            handleLogin(); 
        }
    });
}

async function handleLogin() {
  const code = document.getElementById("passcode").value; // or passcodeField.value
  const users = await window.electronAPI.getUsers();

  const matchedUser = users.find(user => user.Passcode.toString() === code.toString());

  if (!matchedUser) {
    alert("Incorrect passcode.");
    return;
  }

  localStorage.setItem("currentUser", JSON.stringify(matchedUser));

  if (code.length === 4) {
    window.location.href = "student.html";
  } else if (code.length === 6) {
    window.location.href = "staff.html";
  }
}