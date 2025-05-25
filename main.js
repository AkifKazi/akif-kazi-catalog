const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("path");

const { loadExcelFile, getInventory, getUsers, updateItemStock } = require("./backend/inventoryStore");
const {
  addActivity,
  getActivityLog,
  exportActivityLog,
  markItemUsedByActivityID,
  markItemLostByActivityID,
  markItemReturnedByActivityID
} = require("./backend/activityStore");

// Refactored function to handle activity log export
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
ipcMain.handle("update-item-stock", async (event, itemID, quantityChange) => updateItemStock(itemID, quantityChange));

ipcMain.handle("add-activity", async (event, entry) => addActivity(entry)); // Changed from .on to .handle
ipcMain.handle("get-activity-log", async () => getActivityLog()); // Renamed from "get-activity"
ipcMain.handle("mark-item-used", async (event, activityID) => markItemUsedByActivityID(activityID));
ipcMain.handle("mark-item-lost", async (event, activityID) => markItemLostByActivityID(activityID));
ipcMain.handle("mark-item-returned", async (event, activityID) => markItemReturnedByActivityID(activityID));
ipcMain.handle("export-activity-log", async (event) => {
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
