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
    // entry should contain: UserID, UserName, UserSpecs, Action: "Borrowed", ItemID, ItemName, ItemSpecs, Qty, Timestamp
    const newActivity = { ...entry };
    newActivity.activityID = nextActivityId++;
    
    // Ensure Qty is a number, should be positive for borrowed.
    // The actual check for sufficient stock and negative update will be in main.js
    if (newActivity.Qty !== undefined) {
        newActivity.Qty = Number(newActivity.Qty);
        if (isNaN(newActivity.Qty)) {
            console.warn(`addActivity: Invalid Qty provided: ${entry.Qty}. Defaulting to 0.`);
            newActivity.Qty = 0;
        }
    } else {
        console.warn("addActivity: Qty is undefined. Defaulting to 0.");
        newActivity.Qty = 0;
    }

    // Action should be "Borrowed" as per new design
    newActivity.Action = "Borrowed";

    activityLog.push(newActivity);
    saveActivityLog();
    return { success: true, newActivity: newActivity };
  } catch (error) {
    console.error("Error in addActivity (Borrowed):", error);
    return { success: false, error: error.message };
  }
}

// recordStaffReturn is used for "Returned" actions by staff.
// details should contain: UserID (staff), UserName (staff), UserSpecs (staff),
// Action: "Returned", ItemID, ItemName, ItemSpecs, Qty (returned),
// Timestamp, originalBorrowActivityID, Notes.
function recordStaffReturn(details) {
  try {
    const newEntry = {
      activityID: nextActivityId++,
      UserID: details.UserID, // Staff UserID
      UserName: details.UserName, // Staff UserName
      UserSpecs: details.UserSpecs, // Staff UserSpecs (e.g., role)
      Action: "Returned", // Fixed action type
      ItemID: details.ItemID,
      ItemName: details.ItemName,
      ItemSpecs: details.ItemSpecs, // Item specifications
      Qty: Number(details.Qty) || 0, // Quantity returned, ensure it's a number
      Timestamp: details.Timestamp || new Date().toLocaleString(), // Timestamp of the return
      originalBorrowActivityID: details.originalBorrowActivityID, // Link to the original borrow activity
      Notes: details.Notes || "" // Any notes related to the return
    };

    // Validate Qty
    if (isNaN(newEntry.Qty)) {
        console.warn(`recordStaffReturn: Invalid Qty provided: ${details.Qty}. Defaulting to 0.`);
        newEntry.Qty = 0;
    }

    activityLog.push(newEntry);
    saveActivityLog();
    return { success: true, newActivity: newEntry };
  } catch (error) {
    console.error("Error in recordStaffReturn:", error);
    return { success: false, error: error.message };
  }
}

function getActivityLog() {
  return activityLog;
}

function exportReturnedActivitiesLog(filepath) {
  const returnedActivities = activityLog.filter(entry => entry.Action === "Returned");
  const exportData = [];

  returnedActivities.forEach(returnEntry => {
    const originalBorrowEntry = activityLog.find(
      bEntry => bEntry.activityID === returnEntry.originalBorrowActivityID && bEntry.Action === "Borrowed"
    );

    // Staff details from the return entry
    const staffUserID = returnEntry.UserID;
    const staffUserName = returnEntry.UserName;

    let row = {
      // Original Borrower Details
      "Borrower UserID": originalBorrowEntry ? originalBorrowEntry.UserID : null,
      "Borrower UserName": originalBorrowEntry ? originalBorrowEntry.UserName : null,
      "Borrower UserSpecs": originalBorrowEntry ? originalBorrowEntry.UserSpecs : null,
      // Item Details
      "ItemID": originalBorrowEntry ? originalBorrowEntry.ItemID : returnEntry.ItemID, // Fallback to return entry if needed
      "ItemName": originalBorrowEntry ? originalBorrowEntry.ItemName : returnEntry.ItemName,
      "ItemSpecs": originalBorrowEntry ? originalBorrowEntry.ItemSpecs : returnEntry.ItemSpecs,
      // Borrowed Details
      "Borrowed Qty": originalBorrowEntry ? (Number(originalBorrowEntry.Qty) || 0) : null,
      "Borrowed Timestamp": originalBorrowEntry ? originalBorrowEntry.Timestamp : null,
      // Returned Details
      "Returned Qty": Number(returnEntry.Qty) || 0,
      "Returned Timestamp": returnEntry.Timestamp,
      "Return Notes": returnEntry.Notes || "",
      // Staff Details
      "Staff UserID": staffUserID,
      "Staff UserName": staffUserName,
    };
    exportData.push(row);
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { 
    header: [
      "Borrower UserID", "Borrower UserName", "Borrower UserSpecs",
      "ItemID", "ItemName", "ItemSpecs",
      "Borrowed Qty", "Borrowed Timestamp",
      "Returned Qty", "Returned Timestamp", "Return Notes",
      "Staff UserID", "Staff UserName"
    ]
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Returned Activities");
  XLSX.writeFile(workbook, filepath);
}

function exportAllActivitiesLog(filePath) {
  const exportData = activityLog.map(entry => ({
    "ActivityID": entry.activityID,
    "Timestamp": entry.Timestamp,
    "Action": entry.Action, // "Borrowed" or "Returned"
    "UserID": entry.UserID, // Student or Staff ID
    "UserName": entry.UserName,
    "UserSpecs": entry.UserSpecs,
    "ItemID": entry.ItemID,
    "ItemName": entry.ItemName,
    "ItemSpecs": entry.ItemSpecs,
    "Qty": Number(entry.Qty) || 0, // Quantity for this specific transaction
    "Notes": entry.Notes || "", // Mainly for returns
    "OriginalBorrowActivityID": entry.originalBorrowActivityID || "" // For returns
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData, {
    header: [
      "ActivityID", "Timestamp", "Action",
      "UserID", "UserName", "UserSpecs",
      "ItemID", "ItemName", "ItemSpecs",
      "Qty", "Notes", "OriginalBorrowActivityID"
    ]
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "All Activities");
  XLSX.writeFile(workbook, filePath);
}

module.exports = {
  addActivity, // For "Borrowed" logs
  getActivityLog,
  recordStaffReturn, // For "Returned" logs by staff
  exportReturnedActivitiesLog,
  exportAllActivitiesLog
  // saveActivityLog // Not explicitly required to be exported
};
