const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("path");

// Updated imports
const { loadExcelFile, getInventory, getUsers, updateInventoryAfterActivity } = require("./backend/inventoryStore");
const {
  addActivity, // For "Borrowed"
  getActivityLog,
  exportActivityLog, // Updated to filter itself
  recordStaffReturn,
  recordStaffUsed,
  recordStaffLost
} = require("./backend/activityStore");

// Refactored function to handle activity log export - This should still work
async function handleExportActivityLog(browserWindow) {
  if (!browserWindow) {
    console.error("BrowserWindow instance is required to show save dialog.");
    return { success: false, error: "BrowserWindow instance not available." };
  }
  try {
    const result = await dialog.showSaveDialog(browserWindow, {
      title: 'Save Activity Log',
      defaultPath: "activity.xlsx",
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!result.canceled && result.filePath) {
      exportActivityLog(result.filePath);
      // Show message box on the provided browserWindow
      dialog.showMessageBox(browserWindow, { 
        type: 'info',
        title: 'Export Successful',
        message: 'Activity log exported successfully.' 
      });
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Export cancelled by user." };
  } catch (error) {
    console.error("Error exporting activity log:", error);
    dialog.showErrorBox("Export Error", `An error occurred: ${error.message}`);
    return { success: false, error: error.message };
  }
}


// IPC Handlers
ipcMain.handle("get-inventory", async () => getInventory()); // Verified: Returns inventory with new fields
ipcMain.handle("get-users", async () => getUsers());
// Removed ipcMain.handle for "update-item-stock" as function was removed
// Removed ipcMain.handle for "mark-item-used", "mark-item-lost", "mark-item-returned"

ipcMain.handle("add-activity", async (event, entry) => {
  // entry: { UserID, UserName, UserSpecs, Action: "Borrowed", ItemID, ItemName, ItemSpecs, Qty (positive), Timestamp, Notes }
  try {
    // Step 1: Update Inventory and Get QtyRemainingForItem.
    // Note: getActivityLog() is called internally by updateInventoryAfterActivity if it needs the full log.
    // However, the current design of updateInventoryAfterActivity in inventoryStore.js takes fullActivityLog as an argument.
    const fullActivityLog = await getActivityLog(); // Fetch the full log once
    const inventoryUpdateResult = await updateInventoryAfterActivity(entry.ItemID, fullActivityLog);

    if (!inventoryUpdateResult || !inventoryUpdateResult.success || !inventoryUpdateResult.updatedItem) {
      console.error("Failed to update inventory for add-activity:", inventoryUpdateResult.error);
      return { success: false, error: `Failed to update inventory: ${inventoryUpdateResult.error || 'Unknown error'}` };
    }

    // Add QtyRemaining to the entry for logging purposes
    entry.QtyRemaining = inventoryUpdateResult.updatedItem.QtyRemaining;
    // Ensure Qty is positive (it should be from student.js, but double-check)
    entry.Qty = Math.abs(Number(entry.Qty) || 0);


    // Step 2: Add Activity to Log.
    const activityAddResult = await addActivity(entry); // from activityStore.js
    return activityAddResult; // Should be { success: true, newActivity: entry }

  } catch (error) {
    console.error("Error in add-activity handler:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-activity-log", async () => getActivityLog());

ipcMain.handle("record-staff-action", async (event, details) => {
  // console.log("IPC 'record-staff-action' received with details:", details);
  // details: { originalBorrowActivityID, actionType, qtyToProcess, notes, staffUser, itemData }
  try {
    const activityDetails = {
      UserID: details.staffUser.UserID,
      UserName: details.staffUser.UserName,
      UserSpecs: details.staffUser.UserSpecs,
      ItemID: details.itemData.ItemID,
      ItemName: details.itemData.ItemName,
      ItemSpecs: details.itemData.ItemSpecs,
      Qty: Math.abs(Number(details.qtyToProcess) || 0), // Ensure positive
      originalBorrowActivityID: details.originalBorrowActivityID,
      Notes: details.notes
      // QtyRemainingForItem will be added next
    };
    // console.log("Prepared activityDetails (before inventory update):", activityDetails);

    // Step 2: Update Inventory and Get QtyRemainingForItem.
    const fullActivityLog = await getActivityLog(); // Fetch the full log once
    const inventoryUpdateResult = await updateInventoryAfterActivity(details.itemData.ItemID, fullActivityLog);
    // console.log("Inventory update result:", inventoryUpdateResult);
    
    if (!inventoryUpdateResult || !inventoryUpdateResult.success || !inventoryUpdateResult.updatedItem) {
      console.error("Failed to update inventory for record-staff-action:", inventoryUpdateResult.error);
      return { success: false, error: `Failed to update inventory: ${inventoryUpdateResult.error || 'Unknown error'}` };
    }
    
    activityDetails.QtyRemainingForItem = inventoryUpdateResult.updatedItem.QtyRemaining;
    // console.log("activityDetails before calling specific record function:", activityDetails);

    // Step 3: Record the Staff Action.
    let actionResult;
    switch (details.actionType) {
      case "Returned":
        // console.log("Calling 'recordStaffReturn' with:", activityDetails);
        actionResult = await recordStaffReturn(activityDetails);
        break;
      case "Used":
        // console.log("Calling 'recordStaffUsed' with:", activityDetails);
        actionResult = await recordStaffUsed(activityDetails);
        break;
      case "Lost":
        // console.log("Calling 'recordStaffLost' with:", activityDetails);
        actionResult = await recordStaffLost(activityDetails);
        break;
      default:
        console.error("Invalid action type:", details.actionType);
        return { success: false, error: "Invalid action type" };
    }
    return actionResult; // Should be { success: true, newActivity: entry }

  } catch (error) {
    console.error(`Error in record-staff-action handler (${details.actionType}):`, error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle("export-activity-log", async (event) => { // Verified: exportActivityLog in activityStore now filters.
  const win = event.sender.getOwnerBrowserWindow();
  return handleExportActivityLog(win);
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
            label: 'Export Activity',
            click: async () => {
              // Call the refactored function, passing the main window instance
              await handleExportActivityLog(win);
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
