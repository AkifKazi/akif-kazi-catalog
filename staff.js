const activityData = [
  {
    UserID: 203,
    UserName: "Akif Kazi",
    UserSpecs: "LY",
    Timestamp: "21 May 2025",
    Items: [
      { ItemName: "Copic Marker", ItemSpecs: "6 pc", Quantity: 2, Status: "", Notes: "" },
      { ItemName: "Acrylic Paint", ItemSpecs: "12 pc", Quantity: 1, Status: "", Notes: "" }
    ]
  },
  {
    UserID: 635,
    UserName: "Ann Varghese",
    UserSpecs: "LY",
    Timestamp: "22 May 2025",
    Items: [
      { ItemName: "Paint Brush", ItemSpecs: "Flat", Quantity: 1, Status: "", Notes: "" }
    ]
  }
];

function renderActivityLogs() {
  const logContainer = document.getElementById("activity-log");
  logContainer.innerHTML = "";

  activityData.forEach(userLog => {
    const block = document.createElement("div");
    block.className = "activity-user-block";

    const heading = document.createElement("h3");
    heading.textContent = `${userLog.UserName} ${userLog.UserSpecs} — ${userLog.Timestamp}`;
    block.appendChild(heading);

    userLog.Items.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "log-entry";
      div.innerHTML = `
        <strong>${item.ItemName}</strong> (${item.ItemSpecs}) — Quantity: ${item.Quantity}
        <br>
        <button onclick="markUsed(${userLog.UserID}, ${idx})">Used Up</button>
        <button onclick="markLost(${userLog.UserID}, ${idx})">Lost</button>
        <input placeholder="Notes..." oninput="addNote(${userLog.UserID}, ${idx}, this.value)" value="${item.Notes}" />
      `;
      block.appendChild(div);
    });

    logContainer.appendChild(block);
  });
}

function markUsed(userID, idx) {
  const log = activityData.find(log => log.UserID === userID);
  if (log) {
    log.Items[idx].Status = "Used";
    alert(`${log.Items[idx].ItemName} marked as Used.`);
  }
}

function markLost(userID, idx) {
  const log = activityData.find(log => log.UserID === userID);
  if (log) {
    log.Items[idx].Status = "Lost";
    alert(`${log.Items[idx].ItemName} marked as Lost.`);
  }
}

function addNote(userID, idx, value) {
  const log = activityData.find(log => log.UserID === userID);
  if (log) {
    log.Items[idx].Notes = value;
  }
}

document.getElementById("returnBtn").addEventListener("click", () => {
  activityData.forEach(log => {
    log.Items.forEach(item => {
      if (!["Used", "Lost"].includes(item.Status)) {
        item.Status = "Returned";
      }
    });
  });
  alert("All unmarked items set as Returned.");
});

renderActivityLogs();
