const { app, BrowserWindow, Menu, dialog, ipcMain, Notification } = require("electron");
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
ipcMain.handle("get-inventory", async () => getInventory());
ipcMain.handle("get-users", async () => getUsers());

ipcMain.handle("add-activity", async (event, entry) => {
  try {
    // It's still good practice to get a preliminary QtyRemaining for the log entry itself.
    // This reflects the item's state just before this borrow attempt.
    const preBorrowLog = await getActivityLog();
    const preliminaryInventoryState = await updateInventoryAfterActivity(entry.ItemID, preBorrowLog);
    
    if (!preliminaryInventoryState || !preliminaryInventoryState.success || !preliminaryInventoryState.updatedItem) {
      return { success: false, error: `Failed to get preliminary inventory state: ${preliminaryInventoryState.error || 'Unknown error'}` };
    }
    entry.QtyRemaining = preliminaryInventoryState.updatedItem.QtyRemaining; // For this specific log line
    entry.Qty = Math.abs(Number(entry.Qty) || 0);

    // 1. Add the new "Borrowed" activity to the log
    const activityAddResult = await addActivity(entry);
    if (!activityAddResult || !activityAddResult.success) {
      return { success: false, error: `Failed to add borrow activity: ${activityAddResult.error || 'Unknown error'}` };
    }

    // 2. Get the complete and updated activity log (now including the new borrow)
    const completeActivityLog = await getActivityLog();

    // 3. Update the inventory's ActualStock and QtyRemaining based on the complete log
    const finalInventoryUpdateResult = await updateInventoryAfterActivity(entry.ItemID, completeActivityLog);

    if (!finalInventoryUpdateResult || !finalInventoryUpdateResult.success || !finalInventoryUpdateResult.updatedItem) {
      // This is a more critical failure, as inventory might be inconsistent.
      // Consider if any rollback or error logging is needed for activityAddResult.
      return { success: false, error: `Failed to finalize inventory update: ${finalInventoryUpdateResult.error || 'Unknown error'}` };
    }

    // Return success, potentially with the latest item state
    return { 
      success: true, 
      message: "Borrowing successful and inventory updated.",
      updatedItem: finalInventoryUpdateResult.updatedItem, // Send the truly latest item state
      activity: activityAddResult.newActivity // Send the logged activity
    };

  } catch (error) {
    console.error("Error in add-activity handler:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-activity-log", async () => getActivityLog());

ipcMain.handle("record-staff-action", async (event, details) => {
  try {
    const qtyConfirmedReceived = Math.abs(Number(details.qtyToProcess) || 0);
    // Ensure originalBorrowedQty is a number and defaults reasonably if not provided.
    const originalBorrowedQty = Math.abs(Number(details.originalBorrowedQty) || (qtyConfirmedReceived)); 

    let overallSuccess = true;
    let errors = [];
    let finalQtyRemainingForItem;

    // 1. Record "Returned" action if applicable
    if (qtyConfirmedReceived > 0) {
      const returnedActivityDetails = {
        UserID: details.staffUser.UserID,
        UserName: details.staffUser.UserName,
        UserSpecs: details.staffUser.UserSpecs,
        ItemID: details.itemData.ItemID,
        ItemName: details.itemData.ItemName,
        ItemSpecs: details.itemData.ItemSpecs,
        Qty: qtyConfirmedReceived,
        originalBorrowActivityID: details.originalBorrowActivityID,
        Notes: details.notes // User's note applies to the returned part
      };
      // QtyRemainingForItem will be set after all processing by updateInventoryAfterActivity
      const returnResult = await recordStaffReturn(returnedActivityDetails);
      if (!returnResult.success) {
        overallSuccess = false;
        errors.push(returnResult.error || "Failed to record return action.");
      }
    }

    // 2. Record "Lost" action for the difference
    const qtyImplicitlyLost = originalBorrowedQty - qtyConfirmedReceived;
    if (qtyImplicitlyLost > 0) {
      const lostActivityDetails = {
        UserID: details.staffUser.UserID, // Same user context
        UserName: details.staffUser.UserName,
        UserSpecs: details.staffUser.UserSpecs,
        ItemID: details.itemData.ItemID, // Same item
        ItemName: details.itemData.ItemName,
        ItemSpecs: details.itemData.ItemSpecs,
        Qty: qtyImplicitlyLost,
        originalBorrowActivityID: details.originalBorrowActivityID, // Link to the same borrow
        Notes: `Implicitly recorded as lost. Original note: ${details.notes || ""}` // System note
      };
      // QtyRemainingForItem will be set after all processing by updateInventoryAfterActivity
      const lostResult = await recordStaffLost(lostActivityDetails);
      if (!lostResult.success) {
        overallSuccess = false;
        errors.push(lostResult.error || "Failed to record implicit lost action.");
      }
    }

    // 3. Update inventory based on ALL activities (including new ones)
    // It's crucial that getActivityLog() inside updateInventoryAfterActivity or if called before it,
    // fetches the most up-to-date log including the records just added.
    // Assuming activityStore functions (recordStaffReturn, recordStaffLost) correctly update the underlying store
    // before updateInventoryAfterActivity fetches from it.
    
    const currentActivityLog = await getActivityLog(); // Get the freshest log
    const inventoryUpdateResult = await updateInventoryAfterActivity(details.itemData.ItemID, currentActivityLog);

    if (!inventoryUpdateResult || !inventoryUpdateResult.success) {
      overallSuccess = false;
      errors.push(inventoryUpdateResult.error || "Failed to update inventory after actions.");
      // If inventory update fails, QtyRemainingForItem might be stale or undefined
      finalQtyRemainingForItem = 'Error updating inventory'; 
    } else {
      finalQtyRemainingForItem = inventoryUpdateResult.updatedItem.QtyRemaining;
    }

    if (overallSuccess) {
      // The success response should indicate the final state.
      // The individual results of recordStaffReturn/Lost are important for logging,
      // but the main success is that the process completed and inventory is updated.
      return { 
        success: true, 
        message: "Staff action processed.", 
        qtyRemaining: finalQtyRemainingForItem 
      };
    } else {
      return { success: false, error: errors.join("; ") };
    }

  } catch (error) {
    console.error(`Error in record-staff-action handler:`, error);
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
            label: 'Export Activity',
            click: async () => {
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
