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
    const item = log.Items[idx];
    item.Status = "Used";

    window.electronAPI.addActivity({
      UserID: log.UserID,
      UserName: log.UserName,
      UserSpecs: log.UserSpecs,
      Action: "Used",
      ItemID: item.ItemID || (1000 + idx), // use real ID if available
      ItemName: item.ItemName,
      ItemSpecs: item.ItemSpecs,
      QtyChanged: -item.Quantity,
      QtyRemaining: 0,
      Timestamp: new Date().toLocaleString(),
      Notes: item.Notes || ""
    });

    alert(`${item.ItemName} marked as Used.`);
  }
}

function markLost(userID, idx) {
  const log = activityData.find(log => log.UserID === userID);
  if (log) {
    const item = log.Items[idx];
    item.Status = "Lost";

    window.electronAPI.addActivity({
      UserID: log.UserID,
      UserName: log.UserName,
      UserSpecs: log.UserSpecs,
      Action: "Lost",
      ItemID: item.ItemID || (2000 + idx),
      ItemName: item.ItemName,
      ItemSpecs: item.ItemSpecs,
      QtyChanged: -item.Quantity,
      QtyRemaining: 0,
      Timestamp: new Date().toLocaleString(),
      Notes: item.Notes || ""
    });

    alert(`${item.ItemName} marked as Lost.`);
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
    log.Items.forEach((item, idx) => {
      if (!["Used", "Lost"].includes(item.Status)) {
        item.Status = "Returned";

        window.electronAPI.addActivity({
          UserID: log.UserID,
          UserName: log.UserName,
          UserSpecs: log.UserSpecs,
          Action: "Returned",
          ItemID: item.ItemID || (3000 + idx),
          ItemName: item.ItemName,
          ItemSpecs: item.ItemSpecs,
          QtyChanged: 0,
          QtyRemaining: item.Quantity,
          Timestamp: new Date().toLocaleString(),
          Notes: item.Notes || ""
        });
      }
    });
  });

  alert("All unmarked items set as Returned.");
});

renderActivityLogs();
