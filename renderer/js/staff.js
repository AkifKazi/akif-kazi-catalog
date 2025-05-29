// Display current staff user
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const staffUserInfoElement = document.getElementById("staff-user-info");
    if (currentUser && staffUserInfoElement) {
        staffUserInfoElement.textContent = `Staff: ${currentUser.UserName} (${currentUser.UserSpecs})`;
    } else if (staffUserInfoElement) {
        staffUserInfoElement.textContent = "Staff: Not Logged In";
    }
    loadAndRenderActivityLog();
});

async function loadAndRenderActivityLog() {
  const logContainer = document.getElementById("activity-log");
  if (!logContainer) {
    console.error("Activity log container not found!");
    return;
  }
  logContainer.innerHTML = "Loading activities...";

  try {
    const allLogEntries = await window.electronAPI.getActivityLog();
    logContainer.innerHTML = ""; // Clear before rendering

    if (!allLogEntries || allLogEntries.length === 0) {
      logContainer.innerHTML = "<p>No activity records found.</p>";
      return;
    }

    const processedQtyMap = {}; 
    allLogEntries.forEach(entry => {
      if (entry.originalBorrowActivityID && ["Returned", "Used", "Lost"].includes(entry.Action)) {
        processedQtyMap[entry.originalBorrowActivityID] = (processedQtyMap[entry.originalBorrowActivityID] || 0) + (Number(entry.Qty) || 0);
      }
    });
    
    allLogEntries.sort((a, b) => (b.activityID || 0) - (a.activityID || 0));

    allLogEntries.forEach(entry => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "activity-entry";
      entryDiv.style.border = "1px solid #ccc";
      entryDiv.style.marginBottom = "10px";
      entryDiv.style.padding = "10px";

      let entryDetailsHtml = `
        <p><strong>Activity ID:</strong> ${entry.activityID}</p>
        <p><strong>Action:</strong> ${entry.Action}</p>
        <p><strong>User:</strong> ${entry.UserName} (${entry.UserSpecs}, ID: ${entry.UserID})</p>
        <p><strong>Item:</strong> ${entry.ItemName} (${entry.ItemSpecs}, ID: ${entry.ItemID})</p>
        <p><strong>Quantity:</strong> ${entry.Qty}</p>
        <p><strong>Timestamp:</strong> ${entry.Timestamp}</p>
        <p><strong>Item Qty Remaining (at time of log):</strong> ${entry.QtyRemaining}</p>
      `;
      if (entry.originalBorrowActivityID) {
        entryDetailsHtml += `<p><strong>Original Borrow ID:</strong> ${entry.originalBorrowActivityID}</p>`;
      }
      if (entry.Notes) {
        entryDetailsHtml += `<p><strong>Notes:</strong> ${entry.Notes}</p>`;
      }
      entryDiv.innerHTML = entryDetailsHtml;

      if (entry.Action === "Borrowed") {
        const borrowedQty = Number(entry.Qty) || 0;
        const currentProcessedQty = processedQtyMap[entry.activityID] || 0;
        const activeBorrowedQty = borrowedQty - currentProcessedQty;

        const statusDiv = document.createElement("p");
        statusDiv.innerHTML = `<em>Status: ${activeBorrowedQty > 0 ? `${activeBorrowedQty} of ${borrowedQty} pending action.` : `All ${borrowedQty} processed.`}</em>`;
        entryDiv.appendChild(statusDiv);

        if (activeBorrowedQty > 0) {
          entryDiv.style.borderColor = "orange"; 

          // New display structure
          const newControlsDiv = document.createElement("div");
          newControlsDiv.innerHTML = `
            <p><strong>User:</strong> ${entry.UserName} (${entry.UserSpecs})</p>
            <p><strong>Item:</strong> ${entry.ItemName} (${entry.ItemSpecs})</p>
            <p><strong>Quantity Borrowed:</strong> ${entry.Qty}</p>
            <div class="form-group">
                <label for="qty-received-${entry.activityID}">Quantity Received:</label>
                <input type="number" id="qty-received-${entry.activityID}" value="${activeBorrowedQty}" style="width: 60px; margin-right: 10px;">
            </div>
            <div class="form-group">
                <label for="notes-${entry.activityID}">Short Note:</label>
                <input type="text" id="notes-${entry.activityID}" placeholder="Optional notes..." style="margin-right: 10px;">
            </div>
            <p><strong>Timestamp:</strong> ${entry.Timestamp}</p>
          `;
          entryDiv.appendChild(newControlsDiv);

          const buttonsContainer = document.createElement("div");
          buttonsContainer.className = "action-buttons";
          buttonsContainer.style.marginTop = "5px";

          const itemData = { ItemID: entry.ItemID, ItemName: entry.ItemName, ItemSpecs: entry.ItemSpecs };

          // "Confirm" button (renamed from "Mark Returned")
          const confirmButton = document.createElement("button");
          confirmButton.textContent = "Confirm";
          confirmButton.onclick = () => {
              handleStaffAction(entry.activityID, JSON.parse(JSON.stringify(itemData)), activeBorrowedQty, borrowedQty); 
          };
          buttonsContainer.appendChild(confirmButton);
          
          entryDiv.appendChild(buttonsContainer);
        } else {
            entryDiv.style.borderColor = "lightgreen"; 
        }
      } else if (["Returned", "Used", "Lost"].includes(entry.Action)) {
         entryDiv.style.backgroundColor = "#f0f0f0"; 
      }
      
      logContainer.appendChild(entryDiv);
    });

  } catch (error) {
    console.error("Failed to load activity log:", error);
    logContainer.innerHTML = `<p>Error loading activity log: ${error.message}. Please try again later.</p>`;
  }
}

async function handleStaffAction(borrowActivityID, itemData, activeBorrowedQty, originalBorrowedQty) {
  // Get "Quantity Received"
  const qtyReceivedElement = document.getElementById(`qty-received-${borrowActivityID}`);
  const qtyToProcess = Number(qtyReceivedElement.value);
  
  // Retrieve notes from the text input field
  const notesInputElement = document.getElementById(`notes-${borrowActivityID}`);
  const finalNotes = notesInputElement ? notesInputElement.value.trim() : "";

  if (isNaN(qtyToProcess) || qtyToProcess <= 0) {
    window.electronAPI.showNotification("Validation Error", "Invalid quantity. Please enter a positive number.");
    return;
  }
  if (qtyToProcess > activeBorrowedQty) {
    window.electronAPI.showNotification("Validation Error", `Quantity cannot exceed available active borrowed quantity (${activeBorrowedQty}).`);
    return;
  }

  const staffUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!staffUser) {
    window.electronAPI.showNotification("Error", "Staff user not found. Please log in again.");
    return;
  }
  
  const details = {
    originalBorrowActivityID: borrowActivityID,
    actionType: "Returned", // Hardcoded as "Returned"
    qtyToProcess: qtyToProcess,
    notes: finalNotes, 
    staffUser: staffUser, 
    itemData: itemData,
    originalBorrowedQty: originalBorrowedQty // Add this new field
  };

  try {
    const result = await window.electronAPI.recordStaffAction(details);
    if (result && result.success) {
      window.electronAPI.showNotification("Success", result.message || `Successfully processed ${qtyToProcess} of ${itemData.ItemName}.`);
      // Clear the notes field after successful action (optional, as loadAndRenderActivityLog rebuilds UI)
      if (notesInputElement) {
          notesInputElement.value = ""; 
      }
      // Also clear the qty received input
      if (qtyReceivedElement) {
        qtyReceivedElement.value = ""; // Or a sensible default like 0 or activeBorrowedQty post-action
      }
      loadAndRenderActivityLog(); // Refresh the log
    } else {
      window.electronAPI.showNotification("Error", `Failed to record action: ${result ? result.error : 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Error in handleStaffAction (Returned):`, error); // Updated error log
    window.electronAPI.showNotification("Error", `An unexpected error occurred: ${error.message}`);
  }
}
