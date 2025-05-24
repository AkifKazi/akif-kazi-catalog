const fs = require("fs");
const XLSX = require("xlsx");

let inventory = [];
let users = [];

function loadExcelFile(filePath, type = "inventory") {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (type === "inventory") {
      inventory = data;
    } else if (type === "users") {
      users = data;
    }

    return { success: true, rows: data.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getInventory() {
  return inventory;
}

function getUsers() {
  if (users.length === 0) {
    return [
      {
        UserID: 999,
        UserName: "Varun Kapadia",
        Role: "Staff",
        UserSpecs: "Admin",
        Passcode: 892601
      }
    ];
  }
  return users;
}

module.exports = {
  loadExcelFile,
  getInventory,
  getUsers
};
