const fs = require("fs");
const XLSX = require("xlsx");

let activityLog = [];

function addActivity(entry) {
  activityLog.push(entry);
}

function markUsed(userID, itemID) {
  const item = activityLog.find(i => i.UserID === userID && i.ItemID === itemID && i.Action === "Borrowed");
  if (item) {
    item.Action = "Used";
    return true;
  }
  return false;
}

function markLost(userID, itemID) {
  const item = activityLog.find(i => i.UserID === userID && i.ItemID === itemID && i.Action === "Borrowed");
  if (item) {
    item.Action = "Lost";
    return true;
  }
  return false;
}

function returnItemsFor(userID) {
  let itemsReturned = 0;
  activityLog.forEach(item => {
    if (item.UserID === userID && item.Action === "Borrowed") {
      item.Action = "Returned";
      itemsReturned++;
    }
  });
  // As per instructions, returning true indicating the operation was attempted.
  // Alternatively, could return itemsReturned > 0 or itemsReturned count.
  // Sticking to `true` for simplicity as requested.
  return true;
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
  markUsed,
  markLost,
  returnItemsFor,
  exportActivityLog
};
