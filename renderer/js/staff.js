let liveActivityLog = [];

async function loadAndRenderActivity() {
  liveActivityLog = await window.electronAPI.getActivityLog();
  renderActivityLogs();
}

function renderActivityLogs() {
  const logContainer = document.getElementById("activity-log");
  logContainer.innerHTML = ""; // Clear previous logs

  const borrowedItemsByUser = liveActivityLog.reduce((acc, logEntry) => {
    if (logEntry.Action === "Borrowed") {
      if (!acc[logEntry.UserID]) {
        acc[logEntry.UserID] = {
          UserName: logEntry.UserName,
          UserSpecs: logEntry.UserSpecs,
          Timestamp: logEntry.Timestamp, // This will be the timestamp of the first borrowed item for the user
          Items: []
        };
      }
      acc[logEntry.UserID].Items.push({
        ItemID: logEntry.ItemID,
        ItemName: logEntry.ItemName,
        ItemSpecs: logEntry.ItemSpecs,
        Quantity: -logEntry.QtyChanged, // Show positive quantity for borrowed items
        Status: "", // Status will be updated by markUsed/markLost
        Notes: logEntry.Notes || ""
      });
    }
    return acc;
  }, {});

  Object.keys(borrowedItemsByUser).forEach(userID => {
    const userLog = borrowedItemsByUser[userID];
    const numericUserID = parseInt(userID, 10); // Ensure UserID is a number for attribute setting

    const block = document.createElement("div");
    block.className = "activity-user-block";

    // Use the timestamp from the user's first borrowed item, or a generic date if needed.
    // For simplicity, using the timestamp of the user object, which corresponds to one of their borrow actions.
    const heading = document.createElement("h3");
    heading.textContent = `${userLog.UserName} ${userLog.UserSpecs} — ${userLog.Timestamp}`;
    block.appendChild(heading);

    userLog.Items.forEach(item => {
      const div = document.createElement("div");
      div.className = "log-entry";
      // Store UserID and ItemID on the div or directly on buttons
      div.innerHTML = `
        <strong>${item.ItemName}</strong> (${item.ItemSpecs}) — Quantity: ${item.Quantity}
        <br>
        <button data-userid="${numericUserID}" data-itemid="${item.ItemID}">Used Up</button>
        <button data-userid="${numericUserID}" data-itemid="${item.ItemID}">Lost</button>
        <input placeholder="Notes..." data-userid="${numericUserID}" data-itemid="${item.ItemID}" value="${item.Notes}" />
      `;
      // Add event listeners
      const usedButton = div.querySelector('button:nth-of-type(1)');
      usedButton.onclick = function() { markUsed(this); };

      const lostButton = div.querySelector('button:nth-of-type(2)');
      lostButton.onclick = function() { markLost(this); };
      
      const notesInput = div.querySelector('input[type="text"]');
      notesInput.oninput = function() { addNote(this); };

      block.appendChild(div);
    });

    logContainer.appendChild(block);
  });
}

async function markUsed(buttonElement) {
  const userID = buttonElement.dataset.userid;
  const itemID = buttonElement.dataset.itemid;
  console.log(`Attempting to mark item ${itemID} for user ${userID} as Used.`);
  try {
    await window.electronAPI.markItemUsed(userID, itemID);
    alert(`Item ${itemID} marked as Used for user ${userID}. Refreshing list...`);
    loadAndRenderActivity(); // Refresh the activity log
  } catch (error) {
    console.error(`Error marking item ${itemID} as Used for user ${userID}:`, error);
    alert(`Failed to mark item ${itemID} as Used. Error: ${error.message}`);
  }
}

async function markLost(buttonElement) {
  const userID = buttonElement.dataset.userid;
  const itemID = buttonElement.dataset.itemid;
  console.log(`Attempting to mark item ${itemID} for user ${userID} as Lost.`);
  try {
    await window.electronAPI.markItemLost(userID, itemID);
    alert(`Item ${itemID} marked as Lost for user ${userID}. Refreshing list...`);
    loadAndRenderActivity(); // Refresh the activity log
  } catch (error) {
    console.error(`Error marking item ${itemID} as Lost for user ${userID}:`, error);
    alert(`Failed to mark item ${itemID} as Lost. Error: ${error.message}`);
  }
}

function addNote(inputElement) {
  const userID = inputElement.dataset.userid;
  const itemID = inputElement.dataset.itemid;
  const value = inputElement.value;
  // Functionality for addNote is pending.
  // This function will eventually call something like:
  // await window.electronAPI.updateItemNote(userID, itemID, value);
  console.log(`Note updated for item ${itemID}, user ${userID}: ${value}. (Functionality pending)`);
}

async function handleReturnAllItems() {
  try {
    if (!liveActivityLog || liveActivityLog.length === 0) {
      alert("No activity log data to process for returning items.");
      return;
    }

    const usersWithBorrowedItems = new Set();
    liveActivityLog.forEach(logEntry => {
      if (logEntry.Action === "Borrowed") {
        usersWithBorrowedItems.add(logEntry.UserID);
      }
    });

    if (usersWithBorrowedItems.size === 0) {
      alert("No users found with items currently marked as 'Borrowed' in the activity log.");
      // It's important to refresh here as well, in case the log was empty or had no "Borrowed" items.
      // loadAndRenderActivity() will ensure the UI is consistent with the (empty) state.
      await loadAndRenderActivity();
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const totalUsersToProcess = usersWithBorrowedItems.size;

    for (const userID of usersWithBorrowedItems) {
      try {
        // console.log(`Attempting to return items for UserID: ${userID}`); // Optional for debugging
        await window.electronAPI.returnItemsForUser(userID);
        successCount++;
      } catch (error) {
        console.error(`Error returning items for UserID ${userID}:`, error);
        errorCount++;
        // Optionally alert for each error, or summarize at the end
      }
    }

    if (errorCount > 0) {
      alert(`Attempted to return items for ${totalUsersToProcess} user(s). ${successCount} succeeded, ${errorCount} failed. Check console for details.`);
    } else if (successCount > 0) {
      alert(`Successfully processed returns for ${successCount} user(s).`);
    } else {
      // This case could happen if all attempts failed, or if usersWithBorrowedItems was populated
      // but some other condition prevented processing (though not in current logic).
      alert("No items were successfully processed for return. Check console if errors occurred.");
    }

  } catch (error) {
    console.error("Error in handleReturnAllItems:", error);
    alert("An unexpected error occurred while processing returns. Check console for details.");
  } finally {
    // Always refresh the log to show the updated state
    console.log("Refreshing activity log after return all attempt.");
    await loadAndRenderActivity();
  }
}

document.getElementById("returnBtn").addEventListener("click", handleReturnAllItems);

document.addEventListener('DOMContentLoaded', loadAndRenderActivity);
