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
    logContainer.innerHTML = "";

    if (!allLogEntries || allLogEntries.length === 0) {
      logContainer.innerHTML = "<p>No activity records found.</p>";
      return;
    }

    // Calculate processed quantities for each original borrow
    const processedQtyMap = {}; // Key: originalBorrowActivityID, Value: total processed Qty
    allLogEntries.forEach(entry => {
      if (entry.originalBorrowActivityID && ["Returned", "Used", "Lost"].includes(entry.Action)) {
        processedQtyMap[entry.originalBorrowActivityID] = (processedQtyMap[entry.originalBorrowActivityID] || 0) + (Number(entry.Qty) || 0);
      }
    });
    
    // Sort entries, e.g., by activityID descending for recent first
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

      // Action buttons for "Borrowed" items
      if (entry.Action === "Borrowed") {
        const borrowedQty = Number(entry.Qty) || 0;
        const currentProcessedQty = processedQtyMap[entry.activityID] || 0;
        const activeBorrowedQty = borrowedQty - currentProcessedQty;
        // console.log(`For BorrowID ${entry.activityID} ('${entry.ItemName}'): borrowedQty=${borrowedQty}, currentProcessedQty=${currentProcessedQty}, activeBorrowedQty=${activeBorrowedQty}`);


        const statusDiv = document.createElement("p");
        statusDiv.innerHTML = `<em>Status: ${activeBorrowedQty > 0 ? `${activeBorrowedQty} of ${borrowedQty} pending action.` : `All ${borrowedQty} processed.`}</em>`;
        entryDiv.appendChild(statusDiv);

        if (activeBorrowedQty > 0) {
          entryDiv.style.borderColor = "orange"; // Highlight active borrows
          const buttonsContainer = document.createElement("div");
          buttonsContainer.className = "action-buttons";
          buttonsContainer.style.marginTop = "5px";

          // const itemData = { ItemID: entry.ItemID, ItemName: entry.ItemName, ItemSpecs: entry.ItemSpecs }; // Original line
          const itemData = { ItemID: entry.ItemID, ItemName: entry.ItemName, ItemSpecs: entry.ItemSpecs }; // Corrected: remove duplicate, ensure one definition

          const returnButton = document.createElement("button");
          returnButton.textContent = "Mark Returned";
          // console.log("Attaching to Return button:", { borrowActivityID: entry.activityID, itemData, activeBorrowedQty, actionType: "Returned" });
          returnButton.onclick = () => handleStaffAction(entry.activityID, itemData, activeBorrowedQty, "Returned"); 
          buttonsContainer.appendChild(returnButton);

          const usedButton = document.createElement("button");
          usedButton.textContent = "Mark Used";
          // console.log("Attaching to Used button:", { borrowActivityID: entry.activityID, itemData, activeBorrowedQty, actionType: "Used" });
          usedButton.onclick = () => handleStaffAction(entry.activityID, itemData, activeBorrowedQty, "Used");
          buttonsContainer.appendChild(usedButton);

          const lostButton = document.createElement("button");
          lostButton.textContent = "Mark Lost";
          // console.log("Attaching to Lost button:", { borrowActivityID: entry.activityID, itemData, activeBorrowedQty, actionType: "Lost" });
          lostButton.onclick = () => handleStaffAction(entry.activityID, itemData, activeBorrowedQty, "Lost");
          buttonsContainer.appendChild(lostButton);
          
          entryDiv.appendChild(buttonsContainer);
        } else {
            entryDiv.style.borderColor = "lightgreen"; // Indicate fully processed borrows
        }
      } else if (["Returned", "Used", "Lost"].includes(entry.Action)) {
         entryDiv.style.backgroundColor = "#f0f0f0"; // Slightly different background for processed actions
      }
      
      logContainer.appendChild(entryDiv);
    });

  } catch (error) {
    console.error("Failed to load activity log:", error);
    logContainer.innerHTML = `<p>Error loading activity log: ${error.message}. Please try again later.</p>`;
  }
}

async function handleStaffAction(borrowActivityID, itemData, activeBorrowedQty, actionType) {
  // console.log("handleStaffAction called with:", { borrowActivityID, itemData, activeBorrowedQty, actionType });

  const qtyToProcessStr = prompt(`Enter quantity of "${itemData.ItemName}" to mark as ${actionType} (max ${activeBorrowedQty}):`);
  // console.log("qtyToProcessStr from prompt:", qtyToProcessStr);
  if (qtyToProcessStr === null) {
    // console.log("User cancelled prompt.");
    return; 
  }

  const qtyToProcess = Number(qtyToProcessStr);
  // console.log("Parsed qtyToProcess:", qtyToProcess);
  if (isNaN(qtyToProcess) || qtyToProcess <= 0) {
    alert("Invalid quantity. Please enter a positive number.");
    return;
  }
  if (qtyToProcess > activeBorrowedQty) {
    alert(`Quantity cannot exceed available active borrowed quantity (${activeBorrowedQty}).`);
    return;
  }

  // Prompt for notes
  const notesInput = prompt("Enter notes for this action (optional):");
  const finalNotes = notesInput === null ? "" : notesInput;

  const staffUser = JSON.parse(localStorage.getItem("currentUser"));
  // console.log("Retrieved staffUser:", staffUser);
  if (!staffUser) {
    alert("Staff user not found. Please log in again.");
    return;
  }

  const details = {
    originalBorrowActivityID: borrowActivityID,
    actionType: actionType,
    qtyToProcess: qtyToProcess,
    notes: finalNotes, // Use finalNotes here
    staffUser: staffUser, // This is the full staff user object
    itemData: itemData   // This is { ItemID, ItemName, ItemSpecs }
  };
  // console.log("Details object for IPC:", details);

  try {
    const result = await window.electronAPI.recordStaffAction(details);
    // console.log("Result from recordStaffAction IPC:", result);
    if (result && result.success) {
      alert(`Successfully recorded ${qtyToProcess} of ${itemData.ItemName} as ${actionType}.`);
      loadAndRenderActivityLog(); // Refresh the log
    } else {
      alert(`Failed to record action: ${result ? result.error : 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Error in handleStaffAction (${actionType}):`, error);
    alert(`An unexpected error occurred: ${error.message}`);
  }
}

// Optional: Add event listener for an export button if one exists and is desired from this page
// const exportButton = document.getElementById("exportLogBtn");
// if (exportButton) {
//   exportButton.addEventListener("click", async () => {
//     try {
//       const result = await window.electronAPI.exportActivity();
//       if (result && result.success) {
//         alert("Export process initiated. Check for save dialog.");
//       } else if (result && result.error) {
//         alert(`Export failed: ${result.error}`);
//       }
//     } catch (error) {
//       console.error("Error exporting activity log from renderer:", error);
//       alert(`An error occurred during export: ${error.message}`);
//     }
//   });
// }
