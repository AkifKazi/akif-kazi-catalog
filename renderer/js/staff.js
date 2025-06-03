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

    // Event listener for the Clear Data button
    const clearDataButton = document.getElementById('clear-data-button');
    if (clearDataButton) {
        clearDataButton.addEventListener('click', async () => {
            try {
                // Confirmation dialog before proceeding
                const userConfirmed = confirm("Are you sure you want to clear ALL application data? This action cannot be undone and will remove all inventory, user, and activity logs.");
                if (!userConfirmed) {
                    alert('Data clearing was cancelled.');
                    return;
                }

                const result = await window.electronAPI.clearAllData();
                if (result.success) {
                    alert(result.message || 'All application data has been cleared. The application may require a restart or data re-import.');
                    // Optional: Redirect to login page or reload
                    // window.location.href = 'login.html';
                    // Or, to simply reload the current page if staff might need to re-import immediately:
                    // window.location.reload();
                } else {
                    alert(result.message || 'Data clearing failed or was cancelled by the main process.');
                }
            } catch (error) {
                console.error('Error during clearAllData IPC call:', error);
                alert('An error occurred while trying to clear data. Check the console for details.');
            }
        });
    }
});

async function loadAndRenderActivityLog(logEntriesToShow) {
  const logContainer = document.getElementById("activity-log");
  if (!logContainer) {
    console.error("Activity log container not found!");
    return;
  }
  logContainer.innerHTML = "Loading activities...";

  let allLogEntries;
  if (logEntriesToShow) {
    allLogEntries = logEntriesToShow;
    // console.log("Using provided log for render");
  } else {
    // console.log("Fetching new log for render");
    allLogEntries = await window.electronAPI.getActivityLog();
  }

  try {
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
      `;
      // Removed: <p><strong>Item Qty Remaining (at time of log):</strong> ${entry.QtyRemaining}</p>
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
              confirmButton.disabled = true;
              handleStaffAction(entry.activityID, JSON.parse(JSON.stringify(itemData)), activeBorrowedQty, borrowedQty, entryDiv, confirmButton); 
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

async function handleStaffAction(borrowActivityID, itemData, activeBorrowedQty, originalBorrowedQty, entryDiv, confirmButton) {
  // Get "Quantity Received"
  const qtyReceivedElement = document.getElementById(`qty-received-${borrowActivityID}`);
  const qtyToProcess = Number(qtyReceivedElement.value);
  
  // Retrieve notes from the text input field
  const notesInputElement = document.getElementById(`notes-${borrowActivityID}`);
  const finalNotes = notesInputElement ? notesInputElement.value.trim() : "";

  if (isNaN(qtyToProcess) || qtyToProcess <= 0) {
    window.electronAPI.showNotification("Validation Error", "Invalid quantity. Please enter a positive number.");
    if (confirmButton) confirmButton.disabled = false; // Re-enable button
    return;
  }
  if (qtyToProcess > activeBorrowedQty) {
    window.electronAPI.showNotification("Validation Error", `Quantity cannot exceed available active borrowed quantity (${activeBorrowedQty}).`);
    if (confirmButton) confirmButton.disabled = false; // Re-enable button
    return;
  }

  const staffUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!staffUser) {
    window.electronAPI.showNotification("Error", "Staff user not found. Please log in again.");
    if (confirmButton) confirmButton.disabled = false; // Re-enable button
    return;
  }

  // Visual feedback for processing
  // Disable inputs during processing
  if (qtyReceivedElement) qtyReceivedElement.disabled = true;
  if (notesInputElement) notesInputElement.disabled = true;
  entryDiv.style.backgroundColor = 'lightgray';
  const processingMsg = document.createElement('span');
  processingMsg.textContent = " (Processing...)";
  processingMsg.style.fontStyle = "italic";
  entryDiv.appendChild(processingMsg);
  
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
    // Response is now { success: true, message: "Return processed...", updatedItem: ... }
    // It no longer includes result.activityLog
    if (result && result.success) {
      const successMessage = result.message || `${qtyToProcess} item(s) processed successfully.`;
      window.electronAPI.showNotification("Success", successMessage);
      
      if (notesInputElement) {
          notesInputElement.value = ""; 
      }
      if (qtyReceivedElement) {
          qtyReceivedElement.value = ""; // Clear the input
      }
      
      loadAndRenderActivityLog(); // Call without log, will fetch fresh data
    } else {
      window.electronAPI.showNotification("Error", `Failed to record action: ${result ? result.error : 'Unknown error'}`);
      // Clear processing message and re-enable button on error
      if (processingMsg && processingMsg.parentNode === entryDiv) {
        entryDiv.removeChild(processingMsg);
      }
      entryDiv.style.backgroundColor = ''; // Reset background
      if (confirmButton) confirmButton.disabled = false;
      if (qtyReceivedElement) qtyReceivedElement.disabled = false;
      if (notesInputElement) notesInputElement.disabled = false;
    }
  } catch (error) {
    console.error(`Error in handleStaffAction (Returned):`, error); // Updated error log
    window.electronAPI.showNotification("Error", `An unexpected error occurred: ${error.message}`);
    // Clear processing message and re-enable button on error
    if (processingMsg && processingMsg.parentNode === entryDiv) {
      entryDiv.removeChild(processingMsg);
    }
    entryDiv.style.backgroundColor = ''; // Reset background
    if (confirmButton) confirmButton.disabled = false;
    if (qtyReceivedElement) qtyReceivedElement.disabled = false;
    if (notesInputElement) notesInputElement.disabled = false;
  }
}
