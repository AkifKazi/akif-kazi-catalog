// No more hardcoded activityData

async function loadAndRenderActivityLog() {
  const logContainer = document.getElementById("activity-log");
  if (!logContainer) {
    console.error("Activity log container not found!");
    return;
  }
  logContainer.innerHTML = "Loading activities..."; // Placeholder content

  try {
    const logEntries = await window.electronAPI.getActivityLog();
    logContainer.innerHTML = ""; // Clear placeholder or old content

    if (!logEntries || logEntries.length === 0) {
      logContainer.innerHTML = "<p>No activity records found.</p>";
      return;
    }

    // Optional: Group by UserID or display as a flat list
    // For this implementation, we'll do a flat list, sorted by timestamp or activityID if available
    logEntries.sort((a, b) => (b.activityID || 0) - (a.activityID || 0)); // Sort by activityID descending

    logEntries.forEach(entry => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "activity-entry"; // Add a class for styling

      // Basic entry info
      entryDiv.innerHTML = `
        <p><strong>User:</strong> ${entry.UserName} (${entry.UserSpecs}, ID: ${entry.UserID})</p>
        <p><strong>Item:</strong> ${entry.ItemName} (${entry.ItemSpecs}, ID: ${entry.ItemID})</p>
        <p><strong>Action:</strong> ${entry.Action}</p>
        <p><strong>Quantity Changed:</strong> ${entry.QtyChanged}</p>
        <p><strong>Quantity Remaining:</strong> ${entry.QtyRemaining}</p>
        <p><strong>Timestamp:</strong> ${entry.Timestamp}</p>
        <p><strong>Activity ID:</strong> ${entry.activityID}</p>
        ${entry.Notes ? `<p><strong>Notes:</strong> ${entry.Notes}</p>` : ""}
      `;

      // Action Buttons Container
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "action-buttons";

      // Determine which buttons to show based on current Action
      if (entry.Action === "Borrowed") {
        const usedButton = document.createElement("button");
        usedButton.textContent = "Mark as Used";
        usedButton.onclick = () => handleMarkUsed(entry.activityID);
        buttonsContainer.appendChild(usedButton);

        const lostButton = document.createElement("button");
        lostButton.textContent = "Mark as Lost";
        lostButton.onclick = () => handleMarkLost(entry.activityID);
        buttonsContainer.appendChild(lostButton);

        const returnedButton = document.createElement("button");
        returnedButton.textContent = "Mark as Returned";
        returnedButton.onclick = () => handleMarkReturned(entry.activityID);
        buttonsContainer.appendChild(returnedButton);
      } else if (entry.Action === "Used") {
        // If item is "Used", it might still be marked as "Lost" or "Returned" (if "Used" implies consumed but accounted for)
        // Adjust logic based on desired workflow. For now, allowing Lost/Returned from Used.
        const lostButton = document.createElement("button");
        lostButton.textContent = "Mark as Lost";
        lostButton.onclick = () => handleMarkLost(entry.activityID);
        buttonsContainer.appendChild(lostButton);

        const returnedButton = document.createElement("button");
        returnedButton.textContent = "Mark as Returned";
        returnedButton.onclick = () => handleMarkReturned(entry.activityID);
        buttonsContainer.appendChild(returnedButton);
      }
      // No buttons for "Lost" or "Returned" items as they are considered final states for this interaction.

      if (buttonsContainer.hasChildNodes()) {
        entryDiv.appendChild(buttonsContainer);
      }
      
      const hr = document.createElement("hr");
      entryDiv.appendChild(hr);

      logContainer.appendChild(entryDiv);
    });

  } catch (error) {
    console.error("Failed to load activity log:", error);
    logContainer.innerHTML = `<p>Error loading activity log: ${error.message}. Please try again later.</p>`;
  }
}

async function handleMarkUsed(activityID) {
  if (!confirm(`Are you sure you want to mark activity ID ${activityID} as USED?`)) return;
  try {
    const result = await window.electronAPI.markItemUsed(activityID);
    if (result && result.success) {
      alert(`Activity ID ${activityID} successfully marked as Used.`);
      loadAndRenderActivityLog(); // Refresh the log
    } else {
      alert(`Failed to mark item as Used: ${result ? result.error : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in handleMarkUsed:", error);
    alert(`An unexpected error occurred: ${error.message}`);
  }
}

async function handleMarkLost(activityID) {
  if (!confirm(`Are you sure you want to mark activity ID ${activityID} as LOST?`)) return;
  try {
    const result = await window.electronAPI.markItemLost(activityID);
    if (result && result.success) {
      alert(`Activity ID ${activityID} successfully marked as Lost.`);
      loadAndRenderActivityLog(); // Refresh the log
    } else {
      alert(`Failed to mark item as Lost: ${result ? result.error : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in handleMarkLost:", error);
    alert(`An unexpected error occurred: ${error.message}`);
  }
}

async function handleMarkReturned(activityID) {
  if (!confirm(`Are you sure you want to mark activity ID ${activityID} as RETURNED?`)) return;
  try {
    const result = await window.electronAPI.markItemReturned(activityID);
    if (result && result.success) {
      alert(`Activity ID ${activityID} successfully marked as Returned.`);
      loadAndRenderActivityLog(); // Refresh the log
    } else {
      alert(`Failed to mark item as Returned: ${result ? result.error : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in handleMarkReturned:", error);
    alert(`An unexpected error occurred: ${error.message}`);
  }
}

// Add event listener for an optional "Export Activity Log" button
// Assuming a button with id="exportLogBtn" exists in staff.html
const exportButton = document.getElementById("exportLogBtn"); // This ID was commented out in staff.html
if (exportButton) {
  exportButton.addEventListener("click", async () => {
    try {
      // The main process handles the dialog and feedback.
      // The result here might be minimal if the backend doesn't return detailed status for this specific call.
      const result = await window.electronAPI.exportActivity();
      if (result && result.success) { // Assuming exportActivity might return a success status
        alert("Export process initiated. Check for save dialog.");
      } else if (result && result.error) {
        alert(`Export failed: ${result.error}`);
      }
      // If no specific result is returned, the user relies on the main process dialogs.
    } catch (error) {
      console.error("Error exporting activity log from renderer:", error);
      alert(`An error occurred during export: ${error.message}`);
    }
  });
}


// Load the activity log when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadAndRenderActivityLog);
