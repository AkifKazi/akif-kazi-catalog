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
      const processedInventory = data.map(row => {
        const newRow = { ...row }; // Copy existing properties

        let stockValue = 0;
        let stockColumnName = null;

        // Case-insensitive search for 'Stock' column
        for (const key in newRow) {
          if (key.toLowerCase() === 'stock') {
            stockColumnName = key;
            break;
          }
        }

        if (stockColumnName && newRow[stockColumnName] !== undefined) {
          const parsedStock = Number(newRow[stockColumnName]);
          if (!isNaN(parsedStock)) {
            stockValue = parsedStock;
          } else {
            console.warn(`Invalid stock value "${newRow[stockColumnName]}" for item ${newRow.ItemName || newRow.ItemID}. Defaulting to 0.`);
          }
        } else {
          console.warn(`'Stock' column not found for item ${newRow.ItemName || newRow.ItemID}. Defaulting InitialStock, ActualStock, QtyRemaining to 0.`);
        }
        
        // Remove the original 'Stock' column if it exists, to avoid confusion
        // and to prevent it from being part of the final item object if it was different casing.
        if (stockColumnName && stockColumnName.toLowerCase() !== 'stock') {
            delete newRow[stockColumnName];
        }

        newRow.Stock = stockValue; // Use 'Stock' property
        
        // Ensure ItemID is a number if it exists
        if (newRow.ItemID !== undefined) {
            newRow.ItemID = Number(newRow.ItemID);
            if (isNaN(newRow.ItemID)) {
                console.warn(`Invalid ItemID "${row.ItemID}" for item ${newRow.ItemName}. Setting to NaN.`);
            }
        }

        return newRow;
      });

      if (inventory.length > 0) {
        // Re-import logic: Update existing inventory or add new items
        processedInventory.forEach(excelItem => {
          const existingItemIndex = inventory.findIndex(invItem => String(invItem.ItemID) === String(excelItem.ItemID));
          if (existingItemIndex !== -1) {
            // Update stock of existing item
            inventory[existingItemIndex].Stock = excelItem.Stock;
            // Preserve other properties of the existing item
            // For example, if there were other fields managed by the app not present in Excel:
            // inventory[existingItemIndex] = { ...inventory[existingItemIndex], Stock: excelItem.Stock };
          } else {
            // Add new item from Excel
            inventory.push(excelItem);
          }
        });
      } else {
        // Initial import or inventory was empty
        inventory = processedInventory;
      }
      saveInventory();
    } else if (type === "users") {
      // For users, ensure UserID is a number if it exists
      const processedUsers = data.map(user => {
        const newUser = { ...user };
        if (newUser.UserID !== undefined) {
          newUser.UserID = Number(newUser.UserID);
          if (isNaN(newUser.UserID)) {
             console.warn(`Invalid UserID "${user.UserID}" for user ${newUser.UserName}. Setting to NaN.`);
          }
        }
        // Ensure Passcode is a number if it exists
        if (newUser.Passcode !== undefined) {
          newUser.Passcode = Number(newUser.Passcode);
           if (isNaN(newUser.Passcode)) {
             console.warn(`Invalid Passcode "${user.Passcode}" for user ${newUser.UserName}. Setting to NaN.`);
          }
        }
        return newUser;
      });
      users = processedUsers;
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
  const itemIndex = inventory.findIndex(item => String(item.ItemID) === String(itemID));

  if (itemIndex === -1) {
    return { success: false, error: `Item with ID ${itemID} not found.` };
  }

  const item = inventory[itemIndex];
  const currentStock = Number(item.Stock);
  const change = Number(quantityChange);

  if (isNaN(currentStock)) {
    console.warn(`Item ${itemID} has an invalid current stock: ${item.Stock}. Assuming 0.`);
    item.Stock = 0; // Reset to 0 if invalid
  }
  if (isNaN(change)) {
    return { success: false, error: `Invalid quantityChange: ${quantityChange}. Must be a number.` };
  }

  item.Stock = Number(item.Stock) + change;

  if (item.Stock < 0) {
    console.warn(`Item ${itemID} stock fell below zero (${item.Stock}). Setting to 0.`);
    item.Stock = 0;
  }

  saveInventory();
  return { success: true, updatedItem: item };
}

function exportInventory(filePath) {
  try {
    // We can choose to export only specific fields, or all fields.
    // For now, let's assume direct export of existing item properties is fine.
    // If specific columns or order is needed, map the inventory array here.
    // Example: const dataToExport = inventory.map(item => ({ ItemID: item.ItemID, Name: item.ItemName, Stock: item.Stock, ... }));
    const dataToExport = inventory;

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, filePath);
    return { success: true };
  } catch (err) {
    console.error("Error exporting inventory:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  loadExcelFile,
  getInventory,
  getUsers,
  updateItemStock,
  exportInventory, // Export the new function
  // Export save functions if they need to be called from elsewhere, though not strictly required by current instructions
  // saveInventory,
  // saveUsers
};
