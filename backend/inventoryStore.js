const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const userDataPath = app.getPath("userData");
const inventoryFilePath = path.join(userDataPath, "inventory.json");
const usersFilePath = path.join(userDataPath, "users.json");

let inventory = [];
let users = [];

function loadData() {
  try {
    if (fs.existsSync(inventoryFilePath)) {
      const inventoryData = fs.readFileSync(inventoryFilePath, "utf8");
      inventory = JSON.parse(inventoryData);
    } else {
      inventory = [];
    }
  } catch (err) {
    console.error("Error loading inventory data:", err);
    inventory = [];
  }

  try {
    if (fs.existsSync(usersFilePath)) {
      const usersData = fs.readFileSync(usersFilePath, "utf8");
      users = JSON.parse(usersData);
    } else {
      users = [];
    }
  } catch (err) {
    console.error("Error loading users data:", err);
    users = [];
  }
}

function saveInventory() {
  try {
    fs.writeFileSync(inventoryFilePath, JSON.stringify(inventory, null, 2));
  } catch (err) {
    console.error("Error saving inventory data:", err);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error saving users data:", err);
  }
}

loadData(); // Load data when the module is initialized

function loadExcelFile(filePath, type = "inventory") {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (type === "inventory") {
      inventory = data;
      saveInventory();
    } else if (type === "users") {
      users = data;
      saveUsers();
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
  return users;
}

function updateItemStock(itemID, quantityChange) {
  // Ensure itemID is treated as a number if it comes from IPC or other sources as string
  const numericItemID = Number(itemID);
  const itemIndex = inventory.findIndex(item => item.ItemID === numericItemID);

  if (itemIndex !== -1) {
    // Ensure Stock and quantityChange are numbers
    const currentStock = Number(inventory[itemIndex].Stock);
    const numericQuantityChange = Number(quantityChange);

    if (isNaN(currentStock) || isNaN(numericQuantityChange)) {
      console.error(`Error: Invalid stock or quantityChange for ItemID ${numericItemID}. Stock: ${inventory[itemIndex].Stock}, Change: ${quantityChange}`);
      return { success: false, error: `Invalid stock or quantityChange for ItemID ${numericItemID}.` };
    }

    let newStock = currentStock + numericQuantityChange;

    if (newStock < 0) {
      console.warn(`Warning: ItemID ${numericItemID} stock tried to go negative (${newStock}). Setting to 0.`);
      newStock = 0;
    }
    inventory[itemIndex].Stock = newStock;
    saveInventory();
    return { success: true, itemID: numericItemID, newStock: newStock };
  } else {
    return { success: false, error: `Item with ID ${numericItemID} not found.` };
  }
}

module.exports = {
  loadExcelFile,
  getInventory,
  getUsers,
  updateItemStock,
  // Export save functions if they need to be called from elsewhere, though not strictly required by current instructions
  // saveInventory,
  // saveUsers
};
