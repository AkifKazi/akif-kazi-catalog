const logs = await window.electronAPI.getActivity();

async function renderActivityLogs() {
  const logContainer = document.getElementById("activity-log");
  logContainer.innerHTML = "";

  const activityData = await window.electronAPI.getActivity();

  const grouped = {};

  activityData.forEach(entry => {
    const key = `${entry.UserID}|${entry.Timestamp}`;
    if (!grouped[key]) {
      grouped[key] = {
        UserID: entry.UserID,
        UserName: entry.UserName,
        UserSpecs: entry.UserSpecs,
        Timestamp: entry.Timestamp,
        Items: []
      };
    }
    grouped[key].Items.push(entry);
  });

  Object.values(grouped).forEach(group => {
    const block = document.createElement("div");
    block.className = "activity-user-block";

    const heading = document.createElement("h3");
    heading.textContent = `${group.UserName} ${group.UserSpecs} — ${group.Timestamp}`; // ⏰ Date + Time
    block.appendChild(heading);

    group.Items.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "log-entry";
      div.innerHTML = `
        <strong>${item.ItemName}</strong> (${item.ItemSpecs}) — Quantity: ${-item.QtyChanged}
        <br>
        <button onclick="markUsed(${group.UserID}, ${idx})">Used Up</button>
        <button onclick="markLost(${group.UserID}, ${idx})">Lost</button>
        <input placeholder="Notes..." value="${item.Notes || ""}" onchange="addNote(${group.UserID}, ${idx}, this.value)" />
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
