const { app, BrowserWindow, Menu, dialog, ipcMain, Notification } = require("electron");
const path = require("path");

// Updated imports
const { loadExcelFile, getInventory, getUsers, updateItemStock, exportInventory } = require("./backend/inventoryStore"); // Added exportInventory
const {
  addActivity, // For "Borrowed"
  getActivityLog,
  recordStaffReturn, // Simplified
  // recordStaffUsed, // Removed
  // recordStaffLost, // Removed
  exportReturnedActivitiesLog, // New specific export
  exportAllActivitiesLog // New specific export (renamed from generic exportActivityLog)
} = require("./backend/activityStore");

// Updated function to handle ALL activity log export
async function handleExportActivityLog(browserWindow) { // Renamed for clarity, now exports ALL activities
  if (!browserWindow) {
    console.error("BrowserWindow instance is required to show save dialog for all activities export.");
    return { success: false, error: "BrowserWindow instance not available." };
  }
  try {
    const result = await dialog.showSaveDialog(browserWindow, {
      title: 'Save All Activities Log',
      defaultPath: "all_activities.xlsx",
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!result.canceled && result.filePath) {
      exportAllActivitiesLog(result.filePath); // Use the new specific function
      dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'Export Successful',
        message: 'All activities log exported successfully.'
      });
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Export (All Activities) cancelled by user." };
  } catch (error) {
    console.error("Error exporting all activities log:", error);
    dialog.showErrorBox("Export Error", `An error occurred: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// New function to handle RETURNED activity log export
async function handleExportReturnedActivitiesLog(browserWindow) {
  if (!browserWindow) {
    console.error("BrowserWindow instance is required to show save dialog for returned activities export.");
    return { success: false, error: "BrowserWindow instance not available." };
  }
  try {
    const result = await dialog.showSaveDialog(browserWindow, {
      title: 'Save Returned Activities Log',
      defaultPath: "returned_activities.xlsx",
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!result.canceled && result.filePath) {
      exportReturnedActivitiesLog(result.filePath); // Use the new specific function
      dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: 'Export Successful',
        message: 'Returned activities log exported successfully.'
      });
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Export (Returned Activities) cancelled by user." };
  } catch (error) {
    console.error("Error exporting returned activities log:", error);
    dialog.showErrorBox("Export Error", `An error occurred: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function handleExportInventory(browserWindow) {
  if (!browserWindow) {
    console.error("BrowserWindow instance is required to show save dialog for inventory export.");
    return { success: false, error: "BrowserWindow instance not available." };
  }
  try {
    const result = await dialog.showSaveDialog(browserWindow, {
      title: 'Save Inventory Export',
      defaultPath: "inventory_export.xlsx",
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!result.canceled && result.filePath) {
      const exportResult = exportInventory(result.filePath); // From inventoryStore
      if (exportResult.success) {
        dialog.showMessageBox(browserWindow, {
          type: 'info',
          title: 'Export Successful',
          message: 'Inventory exported successfully.'
        });
        return { success: true, filePath: result.filePath };
      } else {
        dialog.showErrorBox("Export Error", `An error occurred during inventory export: ${exportResult.error}`);
        return { success: false, error: exportResult.error };
      }
    }
    return { success: false, error: "Export (Inventory) cancelled by user." };
  } catch (error) {
    console.error("Error exporting inventory:", error);
    dialog.showErrorBox("Export Error", `An error occurred: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// IPC Handlers
ipcMain.handle("get-inventory", async () => getInventory());
ipcMain.handle("get-users", async () => getUsers());

ipcMain.handle("add-activity", async (event, entry) => {
  // entry from frontend: { UserID, UserName, UserSpecs, ItemID, ItemName, ItemSpecs, Qty, Timestamp }
  try {
    const currentInventory = getInventory();
    const item = currentInventory.find(i => String(i.ItemID) === String(entry.ItemID));

    if (!item) {
      return { success: false, error: `Item ID ${entry.ItemID} not found in inventory.` };
    }

    const requestedQty = Number(entry.Qty);
    if (isNaN(requestedQty) || requestedQty <= 0) {
      return { success: false, error: "Invalid quantity requested." };
    }

    console.log(`[main.js] add-activity: Attempting to borrow ItemID: ${entry.ItemID}, Requested Qty: ${requestedQty}`);
    console.log(`[main.js] add-activity: Item details from inventory - ID: ${item.ItemID}, Stock: ${item.Stock}`);

    if (Number(item.Stock) < requestedQty) {
      return { success: false, error: `Not enough stock for item ID ${entry.ItemID}. Available: ${item.Stock}, Requested: ${requestedQty}` };
    }

    // Prepare log entry data for activityStore
    const logEntryData = {
      UserID: entry.UserID,
      UserName: entry.UserName,
      UserSpecs: entry.UserSpecs, // e.g., Batch or Class
      Action: "Borrowed", // This will be set by activityStore.addActivity, but good to be explicit
      ItemID: entry.ItemID,
      ItemName: item.ItemName, // Use item name from inventory for consistency
      ItemSpecs: item.ItemSpecs, // Use item specs from inventory
      Qty: requestedQty,
      Timestamp: entry.Timestamp || new Date().toLocaleString()
    };

    const activityAddResult = addActivity(logEntryData); // activityStore.addActivity is synchronous now
    if (!activityAddResult || !activityAddResult.success) {
      return { success: false, error: `Failed to add borrow activity: ${activityAddResult.error || 'Unknown error'}` };
    }

    // Update inventory stock
    const stockUpdateResult = updateItemStock(entry.ItemID, -requestedQty); // Pass negative quantity for borrow

    if (!stockUpdateResult || !stockUpdateResult.success) {
      // Potentially roll back activity log? For now, log critical error and inform user.
      console.error(`CRITICAL: Activity logged (ID: ${activityAddResult.newActivity.activityID}) but inventory stock update failed for item: ${entry.ItemID}`);
      return {
        success: false,
        error: `Borrow activity logged, but failed to update item stock. Please check inventory. Error: ${stockUpdateResult.error || 'Unknown error'}`
      };
    }

    return {
      success: true,
      message: "Borrowing successful and inventory updated.",
      updatedItem: stockUpdateResult.updatedItem,
      activity: activityAddResult.newActivity
    };

  } catch (error) {
    console.error("Error in add-activity (borrow) handler:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-activity-log", async () => getActivityLog());

// This handler is now SOLELY for processing returns.
ipcMain.handle("record-staff-action", async (event, details) => {
  // details from frontend: { staffUser, itemData, qtyToProcess, originalBorrowActivityID, notes }
  try {
    const qtyReturned = Number(details.qtyToProcess);
    if (isNaN(qtyReturned) || qtyReturned <= 0) {
      return { success: false, error: "Invalid quantity to return." };
    }

    // Ensure itemData is present and has ItemID
    if (!details.itemData || details.itemData.ItemID === undefined) {
        return { success: false, error: "Item data is missing or invalid." };
    }

    // Ensure staffUser is present
    if (!details.staffUser || !details.staffUser.UserID) {
        return { success: false, error: "Staff user details are missing." };
    }

    const currentInventory = getInventory();
    const itemBeingReturned = currentInventory.find(i => String(i.ItemID) === String(details.itemData.ItemID));

    if (!itemBeingReturned) {
        // This case should ideally not happen if itemData comes from a valid source, but good to check.
        return { success: false, error: `Item ID ${details.itemData.ItemID} not found in inventory for return.` };
    }

    // Prepare log entry data for the return
    const returnLogDetails = {
      UserID: details.staffUser.UserID, // Staff UserID
      UserName: details.staffUser.UserName, // Staff UserName
      UserSpecs: details.staffUser.UserSpecs, // Staff Role/Specs
      Action: "Returned", // Set by activityStore.recordStaffReturn
      ItemID: details.itemData.ItemID,
      ItemName: itemBeingReturned.ItemName, // Use name from current inventory
      ItemSpecs: itemBeingReturned.ItemSpecs, // Use specs from current inventory
      Qty: qtyReturned,
      Timestamp: new Date().toLocaleString(),
      originalBorrowActivityID: details.originalBorrowActivityID,
      Notes: details.notes || ""
    };

    const returnLogResult = recordStaffReturn(returnLogDetails); // activityStore.recordStaffReturn is synchronous
    if (!returnLogResult || !returnLogResult.success) {
      return { success: false, error: `Failed to record return activity: ${returnLogResult.error || 'Unknown error'}` };
    }

    // Update inventory stock (add back the returned quantity)
    const stockUpdateResult = updateItemStock(details.itemData.ItemID, qtyReturned); // Positive quantity

    if (!stockUpdateResult || !stockUpdateResult.success) {
      console.error(`CRITICAL: Return activity logged (ID: ${returnLogResult.newActivity.activityID}) but inventory stock update failed for item: ${details.itemData.ItemID}`);
      return { 
        success: false,
        error: `Return activity logged, but failed to update item stock. Please check inventory. Error: ${stockUpdateResult.error || 'Unknown error'}`
      };
    }

    return {
      success: true,
      message: "Return processed successfully and inventory updated.",
      updatedItem: stockUpdateResult.updatedItem,
      activity: returnLogResult.newActivity
    };

  } catch (error) {
    console.error("Error in record-staff-action (return) handler:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-activity-log", async (event) => { 
  const win = event.sender.getOwnerBrowserWindow();
  return handleExportActivityLog(win);
});

ipcMain.on("show-notification", (event, title, body) => {
  if (Notification.isSupported()) { // Check if platform supports notifications
    const notification = new Notification({
      title: title,
      body: body,
      // You can add other options like 'icon' if you have one
    });
    notification.show();
  } else {
    console.log("Notifications not supported on this platform. Title:", title, "Body:", body);
    // As a fallback, you could dialog.showMessageBox, but for now, console log is fine.
    // dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], { type: 'info', title: title, message: body });
  }
});

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("renderer/login.html");

  const isMac = process.platform === 'darwin';
  const menuTemplate = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
        label: 'Import Inventory',
        click: async () => {
            const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
            const status = loadExcelFile(result.filePaths[0], "inventory");
            if (!status.success) {
                dialog.showErrorBox("Import Error", status.error);
            } else {
                dialog.showMessageBox(win, {
                type: 'info',
                title: 'Inventory Imported',
                message: `Successfully imported ${status.rows} items from Excel.`,
                });
            }
            }
        }
        },
        {
        label: 'Import Users',
        click: async () => {
            const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
            const status = loadExcelFile(result.filePaths[0], "users");
            if (!status.success) {
                dialog.showErrorBox("Import Error", status.error);
            } else {
                dialog.showMessageBox(win, {
                type: 'info',
                title: 'Users Imported',
                message: `Successfully imported ${status.rows} users from Excel.`,
                });
            }
            }
        }
        },
        {
        label: 'Export',
        submenu: [
            {
            label: 'Export All Activities', // Changed label
            click: async () => {
              await handleExportActivityLog(win); // This now calls exportAllActivitiesLog
            }
            },
            {
            label: 'Export Returned Activities', // New menu item
            click: async () => {
              await handleExportReturnedActivitiesLog(win);
            }
            },
            {
            label: 'Export Inventory', // New menu item for inventory
            click: async () => {
              await handleExportInventory(win);
            }
            }
        ]
        },
        {
        label: 'Logout',
        click: () => {
            win.loadFile("renderer/login.html");
            win.webContents.executeJavaScript('localStorage.clear()');
        }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
