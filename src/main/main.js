const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');

// Require Stores and Handlers
const UserStore = require('./stores/UserStore');
const InventoryStore = require('./stores/InventoryStore');
const ActivityStore = require('./stores/ActivityStore');
const excelHandler = require('./excel-handler'); 
const coreLogic = require('./core-logic');     

let mainWindow;
let userStore, inventoryStore, activityStore; 

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/login/login.html'));
  // mainWindow.webContents.openDevTools(); 

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Import Users...',
        click: async () => {
          if (!userStore || !mainWindow) {
            console.error("UserStore or main window not available for user import.");
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Error', message: 'User import feature not ready.' });
            return;
          }
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { 
            title: 'Import Users Excel File', 
            properties: ['openFile'], 
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }] 
          });
          if (!canceled && filePaths && filePaths.length > 0) {
            const result = await excelHandler.importUsersFromExcel(filePaths[0], userStore);
            const message = result.success 
              ? `Imported ${result.importedCount} users.${result.skippedCount > 0 ? ` Skipped ${result.skippedCount} rows (check console for details).` : ''}` 
              : `Error: ${result.error || 'Failed to import users.'}`;
            dialog.showMessageBox(mainWindow, { type: result.success ? 'info' : 'error', title: 'Import Users Result', message: message });
          }
        }
      },
      {
        label: 'Import Inventory...',
        click: async () => {
          if (!inventoryStore || !mainWindow) {
            console.error("InventoryStore or main window not available for inventory import.");
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Error', message: 'Inventory import feature not ready.' });
            return;
          }
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { 
            title: 'Import Inventory Excel File', 
            properties: ['openFile'], 
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }] 
          });
          if (!canceled && filePaths && filePaths.length > 0) {
            const result = await excelHandler.importInventoryFromExcel(filePaths[0], inventoryStore);
            const message = result.success 
              ? `Imported ${result.importedCount} inventory items.${result.skippedCount > 0 ? ` Skipped ${result.skippedCount} rows (check console for details).` : ''}` 
              : `Error: ${result.error || 'Failed to import inventory.'}`;
            dialog.showMessageBox(mainWindow, { type: result.success ? 'info' : 'error', title: 'Import Inventory Result', message: message });
          }
        }
      },
      {
        label: 'Export Activity Log...',
        click: async () => {
          if (!activityStore || !mainWindow) {
            console.error("ActivityStore or main window not available for export.");
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Error', message: 'Export feature not ready.' });
            return;
          }
          // As per Subtask 22, exportActivityLogToExcel expects all entries and does its own mapping.
          // The specific filtering for "Returned", "Used", "Lost" is if we want to *only* export those types.
          // The prompt here says "filter activities for export (e.g. "Returned", "Used", "Lost")".
          // This implies the filtering should happen *before* calling excelHandler.
          const activitiesToExport = activityStore.getAllActivities().filter(act => 
            ["Returned", "Used", "Lost"].includes(act.Action)
          );

          if (!activitiesToExport || activitiesToExport.length === 0) {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Export Activity Log', message: 'No staff actions (Returned, Used, Lost) to export.' });
            return;
          }
          const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { 
            title: 'Save Activity Log As', 
            defaultPath: 'staff-activity-log.xlsx', 
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }] 
          });
          if (!canceled && filePath) {
            const result = await excelHandler.exportActivityLogToExcel(filePath, activitiesToExport);
            const message = result.success 
              ? `Activity log exported to ${result.filePath}` 
              : `Error: ${result.error || 'Failed to export activity log.'}`;
            dialog.showMessageBox(mainWindow, { type: result.success ? 'info' : 'error', title: 'Export Result', message: message });
          }
        }
      },
      { type: 'separator' },
      { role: process.platform === 'darwin' ? 'close' : 'quit' }
    ]
  },
  {
    label: 'View',
    submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
    ]
  }
];

app.whenReady().then(() => {
  // Instantiate Stores first
  userStore = new UserStore(app);
  inventoryStore = new InventoryStore(app);
  activityStore = new ActivityStore(app);

  createWindow(); 
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Setup IPC Handlers after stores are initialized
  setupIpcHandlers(userStore, inventoryStore, activityStore, excelHandler, coreLogic);
});

function setupIpcHandlers(userStoreInstance, inventoryStoreInstance, activityStoreInstance, excelHandlerInstance, coreLogicInstance) {
    ipcMain.handle('auth:login', async (event, passcode) => {
        const user = userStoreInstance.findUserByPasscode(passcode);
        if (!user) return { success: false, error: 'Invalid passcode.' };

        const role = String(user.Role);
        const strPasscode = String(user.Passcode);
        const inputPasscode = String(passcode);

        // Validate passcode format against role and then value
        if (role === 'Student' && /^[0-9]{4}$/.test(inputPasscode) && strPasscode === inputPasscode) {
            return { success: true, user: { UserID: user.UserID, UserName: user.UserName, Role: user.Role, UserSpecs: user.UserSpecs } };
        } else if (role === 'Staff' && /^[a-zA-Z0-9]{6}$/.test(inputPasscode) && strPasscode === inputPasscode) {
            return { success: true, user: { UserID: user.UserID, UserName: user.UserName, Role: user.Role, UserSpecs: user.UserSpecs } };
        }
        // If passcode matched but format/role validation failed above
        if (strPasscode === inputPasscode) { 
            return { success: false, error: 'Passcode format incorrect for assigned role.' };
        }
        return { success: false, error: 'Invalid passcode.' }; // Fallback for non-matching passcode
    });

    ipcMain.handle('inventory:get-all', async () => inventoryStoreInstance.getInventory());

    ipcMain.handle('activity:get-all', async () => activityStoreInstance.getAllActivities());

    ipcMain.handle('activity:log-borrow', async (event, borrowData) => {
        const prepResult = coreLogicInstance.validateAndPrepareBorrowAction(borrowData, inventoryStoreInstance);
        if (!prepResult.success) return prepResult;

        // Create a temporary activity entry to simulate its presence in the log for calculation
        const tempActivityForCalc = { ...prepResult.preparedActivityData }; 
        const allActivitiesForCalc = [...activityStoreInstance.getAllActivities(), tempActivityForCalc];
        
        const invUpdateResult = await inventoryStoreInstance.recalculateAndSaveItemState(borrowData.itemID, allActivitiesForCalc);
        if (!invUpdateResult.success || !invUpdateResult.updatedItem) {
             return { success: false, error: `Inventory update failed: ${invUpdateResult.error || 'Unknown error'}. Borrow not logged.` };
        }
        
        const activityDataToLog = {
            ...prepResult.preparedActivityData,
            ItemQtyRemainingAfterThisAction: invUpdateResult.updatedItem.QtyRemaining
        };
        
        const loggedActivity = activityStoreInstance.addActivity(activityDataToLog);
        return { success: true, loggedActivity, updatedItem: invUpdateResult.updatedItem };
    });

    ipcMain.handle('activity:log-staff-action', async (event, staffActionData) => {
        const prepResult = coreLogicInstance.validateAndPrepareStaffAction(staffActionData, inventoryStoreInstance, activityStoreInstance);
        if (!prepResult.success) return prepResult;

        const tempActivityForCalc = { ...prepResult.preparedActivityData };
        const allActivitiesForCalc = [...activityStoreInstance.getAllActivities(), tempActivityForCalc];

        const invUpdateResult = await inventoryStoreInstance.recalculateAndSaveItemState(staffActionData.itemID, allActivitiesForCalc);
        if (!invUpdateResult.success || !invUpdateResult.updatedItem) {
            return { success: false, error: `Inventory update failed: ${invUpdateResult.error || 'Unknown error'}. Action not logged.` };
        }
        
        const activityDataToLog = {
            ...prepResult.preparedActivityData,
            ItemQtyRemainingAfterThisAction: invUpdateResult.updatedItem.QtyRemaining
        };
        const loggedActivity = activityStoreInstance.addActivity(activityDataToLog);
        return { success: true, loggedActivity, updatedItem: invUpdateResult.updatedItem };
    });
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) { 
    createWindow();
  }
});
