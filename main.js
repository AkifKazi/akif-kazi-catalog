const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("path");

const { loadExcelFile, getInventory, getUsers } = require("./backend/inventoryStore");
const {
  addActivity,
  getActivityLog,
  exportActivityLog
} = require("./backend/activityStore");

ipcMain.handle("get-activity", () => getActivityLog());
ipcMain.on("add-activity", (event, entry) => addActivity(entry));

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
                const result = await dialog.showSaveDialog({
                title: 'Save Activity Log',
                defaultPath: "activity.xlsx",
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
                });

                if (!result.canceled && result.filePath) {
                exportActivityLog(result.filePath);
                dialog.showMessageBox({ message: 'Activity log exported successfully.' });
                }
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

ipcMain.handle("get-inventory", async () => {
  return getInventory();
});

ipcMain.handle("get-users", async () => {
  return getUsers();
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
