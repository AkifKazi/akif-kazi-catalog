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
        if (stockColumnName) {
            delete newRow[stockColumnName];
        }

        newRow.InitialStock = stockValue;
        newRow.ActualStock = stockValue;
        newRow.QtyRemaining = stockValue;
        
        // Ensure ItemID is a number if it exists
        if (newRow.ItemID !== undefined) {
            newRow.ItemID = Number(newRow.ItemID);
            if (isNaN(newRow.ItemID)) {
                console.warn(`Invalid ItemID "${row.ItemID}" for item ${newRow.ItemName}. Setting to NaN.`);
            }
        }

        return newRow;
      });
      inventory = processedInventory;
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

// Helper function - NOT EXPORTED
function recalculateInventoryFieldsForItem(itemObject, fullActivityLog) {
  if (!itemObject || itemObject.InitialStock === undefined) {
    console.error("recalculateInventoryFieldsForItem: Invalid itemObject or InitialStock missing", itemObject);
    // Potentially throw an error or handle as appropriate
    return; 
  }
  const numericItemID = Number(itemObject.ItemID);
  const relevantActivities = fullActivityLog.filter(entry => Number(entry.ItemID) === numericItemID);

  let totalUsedOrLost = 0;
  relevantActivities.forEach(entry => {
    if (entry.Action === "Used" || entry.Action === "Lost") {
      totalUsedOrLost += Math.abs(Number(entry.Qty) || 0); // Changed to entry.Qty
    }
  });

  itemObject.ActualStock = Number(itemObject.InitialStock) - totalUsedOrLost;
  if (itemObject.ActualStock < 0) {
    itemObject.ActualStock = 0;
  }

  // Corrected QtyRemaining calculation
  const totalBorrowed = relevantActivities
    .filter(entry => entry.Action === "Borrowed")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.Qty || 0)), 0); // Changed to entry.Qty

  const totalReturned = relevantActivities
    .filter(entry => entry.Action === "Returned")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.Qty || 0)), 0); // Changed to entry.Qty

  const netBorrowed = totalBorrowed - totalReturned;
  itemObject.QtyRemaining = itemObject.ActualStock - netBorrowed;

  // Apply caps
  if (itemObject.QtyRemaining < 0) {
    itemObject.QtyRemaining = 0;
  }
  if (itemObject.QtyRemaining > itemObject.ActualStock) {
    itemObject.QtyRemaining = itemObject.ActualStock;
  }
}

// EXPORTED function
function updateInventoryAfterActivity(itemID, fullActivityLog) {
  const numericItemID = Number(itemID); // Ensure numeric comparison
  if (isNaN(numericItemID)) {
    console.error(`updateInventoryAfterActivity: Invalid ItemID provided: ${itemID}`);
    return { success: false, error: `Invalid ItemID: ${itemID}` };
  }

  const itemIndex = inventory.findIndex(invItem => Number(invItem.ItemID) === numericItemID);

  if (itemIndex !== -1) {
    // Ensure InitialStock is a number before recalculating
    if (inventory[itemIndex].InitialStock === undefined || isNaN(Number(inventory[itemIndex].InitialStock))) {
        console.error(`Item ${numericItemID} has invalid or missing InitialStock: ${inventory[itemIndex].InitialStock}. Cannot recalculate.`);
        inventory[itemIndex].InitialStock = 0; // Default to 0 if missing/invalid to prevent further errors.
    } else {
        inventory[itemIndex].InitialStock = Number(inventory[itemIndex].InitialStock);
    }

    recalculateInventoryFieldsForItem(inventory[itemIndex], fullActivityLog);
    saveInventory(); // Persist changes
    return { success: true, updatedItem: inventory[itemIndex] };
  } else {
    console.warn(`updateInventoryAfterActivity: Item with ID ${numericItemID} not found.`);
    return { success: false, error: `Item with ID ${numericItemID} not found.` };
  }
}


module.exports = {
  loadExcelFile,
  getInventory,
  getUsers,
  updateInventoryAfterActivity, // Added for export
  // Export save functions if they need to be called from elsewhere, though not strictly required by current instructions
  // saveInventory,
  // saveUsers
};
