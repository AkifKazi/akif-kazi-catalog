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

function addActivity(entry) {
  try {
    entry.activityID = nextActivityId++;
    activityLog.push(entry);
    saveActivityLog();
    return { success: true, activityID: entry.activityID };
  } catch (error) {
    console.error("Error in addActivity:", error);
    return { success: false, error: error.message };
  }
}

function markItemUsedByActivityID(activityID) {
  const activity = activityLog.find(a => a.activityID === activityID);
  if (activity) {
    if (activity.Action === "Borrowed") { // Can only mark "Borrowed" items as "Used"
      activity.Action = "Used";
      // Optionally, add/update a timestamp for this specific action
      // activity.lastModified = new Date().toISOString(); 
      saveActivityLog();
      return { success: true };
    } else {
      return { success: false, error: `Activity ${activityID} is not in 'Borrowed' state, cannot mark as 'Used'. Current state: ${activity.Action}` };
    }
  }
  return { success: false, error: `Activity with ID ${activityID} not found.` };
}

function markItemLostByActivityID(activityID) {
  const activity = activityLog.find(a => a.activityID === activityID);
  if (activity) {
     if (activity.Action === "Borrowed" || activity.Action === "Used") { // Can only mark "Borrowed" or "Used" items as "Lost"
      activity.Action = "Lost";
      // activity.lastModified = new Date().toISOString();
      saveActivityLog();
      return { success: true };
    } else {
      return { success: false, error: `Activity ${activityID} is not in 'Borrowed' or 'Used' state, cannot mark as 'Lost'. Current state: ${activity.Action}` };
    }
  }
  return { success: false, error: `Activity with ID ${activityID} not found.` };
}

function markItemReturnedByActivityID(activityID) {
  const activity = activityLog.find(a => a.activityID === activityID);
  if (activity) {
    if (activity.Action === "Borrowed" || activity.Action === "Used") { // Can only mark "Borrowed" or "Used" items as "Returned"
      activity.Action = "Returned";
      // activity.lastModified = new Date().toISOString();
      saveActivityLog();
      return { success: true };
    } else {
      return { success: false, error: `Activity ${activityID} is not in 'Borrowed' or 'Used' state, cannot mark as 'Returned'. Current state: ${activity.Action}` };
    }
  }
  return { success: false, error: `Activity with ID ${activityID} not found.` };
}

function getActivityLog() {
  return activityLog;
}

function exportActivityLog(filepath) {
  const worksheet = XLSX.utils.json_to_sheet(activityLog);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity");
  XLSX.writeFile(workbook, filepath);
}

module.exports = {
  addActivity,
  getActivityLog,
  markItemUsedByActivityID,
  markItemLostByActivityID,
  markItemReturnedByActivityID,
  exportActivityLog
  // saveActivityLog // Not explicitly required to be exported
};
