const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const userDataPath = app.getPath("userData");
const activityLogFilePath = path.join(userDataPath, "activityLog.json");

let activityLog = [];
let nextActivityId = 1; // Initialize at the top of the module

function loadActivityLog() {
  try {
    if (fs.existsSync(activityLogFilePath)) {
      const activityLogData = fs.readFileSync(activityLogFilePath, "utf8");
      activityLog = JSON.parse(activityLogData);
      if (activityLog.length > 0) {
        // Ensure nextActivityId is greater than any existing activityID
        const maxId = Math.max(...activityLog.map(a => a.activityID || 0).filter(id => !isNaN(id) && id !== null));
        nextActivityId = (isFinite(maxId) ? maxId : 0) + 1;
      } else {
        nextActivityId = 1;
      }
    } else {
      activityLog = [];
      nextActivityId = 1;
    }
  } catch (err) {
    console.error("Error loading activity log data:", err);
    activityLog = [];
    nextActivityId = 1;
  }
}

function saveActivityLog() {
  try {
    fs.writeFileSync(activityLogFilePath, JSON.stringify(activityLog, null, 2));
  } catch (err) {
    console.error("Error saving activity log data:", err);
  }
}

loadActivityLog(); // Load data when the module is initialized

// addActivity is used for "Borrowed" actions primarily from student.js
// It expects entry.Qty (positive) and entry.QtyRemaining (overall item qty remaining)
function addActivity(entry) {
  try {
    const newEntry = { ...entry }; // Clone to avoid modifying the original object if passed by reference
    newEntry.activityID = nextActivityId++;
    
    // Ensure Qty is positive, as per requirements
    if (newEntry.Qty !== undefined) {
        newEntry.Qty = Math.abs(Number(newEntry.Qty) || 0);
    } else {
        console.warn("addActivity: Qty is undefined. Defaulting to 0.");
        newEntry.Qty = 0;
    }

    // QtyRemaining is passed in and should be stored as is.
    // newEntry.QtyRemaining should already be set from the caller.

    activityLog.push(newEntry);
    saveActivityLog();
    return { success: true, newActivity: newEntry };
  } catch (error) {
    console.error("Error in addActivity:", error);
    return { success: false, error: error.message };
  }
}

// Generic function for staff to record actions (Used, Lost, Returned)
function recordStaffAction(details, actionType) {
  try {
    const newEntry = {
      activityID: nextActivityId++,
      UserID: details.UserID,
      UserName: details.UserName,
      UserSpecs: details.UserSpecs,
      Action: actionType, // "Returned", "Used", "Lost"
      ItemID: details.ItemID,
      ItemName: details.ItemName,
      ItemSpecs: details.ItemSpecs,
      Qty: Math.abs(Number(details.Qty) || 0), // Ensure Qty is positive
      QtyRemaining: details.QtyRemainingForItem, // Overall item quantity remaining
      Timestamp: new Date().toLocaleString(),
      originalBorrowActivityID: details.originalBorrowActivityID || null,
      Notes: details.Notes || ""
    };
    activityLog.push(newEntry);
    saveActivityLog();
    return { success: true, newActivity: newEntry };
  } catch (error) {
    console.error(`Error in recordStaffAction (${actionType}):`, error);
    return { success: false, error: error.message };
  }
}

function recordStaffReturn(details) {
  return recordStaffAction(details, "Returned");
}

function recordStaffUsed(details) {
  return recordStaffAction(details, "Used");
}

function recordStaffLost(details) {
  return recordStaffAction(details, "Lost");
}

function getActivityLog() {
  return activityLog;
}

function exportActivityLog(filepath) {
  const returnedActivities = activityLog.filter(entry => entry.Action === "Returned");
  const exportData = [];

  returnedActivities.forEach(returnEntry => {
    const originalBorrowEntry = activityLog.find(
      bEntry => bEntry.activityID === returnEntry.originalBorrowActivityID && bEntry.Action === "Borrowed"
    );

    let row = {
      "Student ID": originalBorrowEntry ? originalBorrowEntry.UserID : null,
      "Name": originalBorrowEntry ? originalBorrowEntry.UserName : null,
      "Batch": originalBorrowEntry ? originalBorrowEntry.UserSpecs : null,
      "Returned": Math.abs(Number(returnEntry.Qty) || 0), // Ensure positive
      "Borrowed": originalBorrowEntry ? Math.abs(Number(originalBorrowEntry.Qty) || 0) : null, // Ensure positive
      "Item": originalBorrowEntry ? originalBorrowEntry.ItemName : null,
      "Details": originalBorrowEntry ? originalBorrowEntry.ItemSpecs : null,
      "Borrow Timestamp": originalBorrowEntry ? originalBorrowEntry.Timestamp : null,
      "Return Timestamp": returnEntry.Timestamp,
      // Notes will be aggregated below
    };

    row["Notes"] = returnEntry.Notes || ""; // Use only the note from the "Returned" action.

    exportData.push(row);
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { 
    header: ["Student ID", "Name", "Batch", "Returned", "Borrowed", "Item", "Details", "Borrow Timestamp", "Return Timestamp", "Notes"] 
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Log");
  XLSX.writeFile(workbook, filepath);
}

module.exports = {
  addActivity, // For "Borrowed" logs
  getActivityLog,
  recordStaffReturn,
  recordStaffUsed,
  recordStaffLost,
  exportActivityLog
  // saveActivityLog // Not explicitly required to be exported
};
