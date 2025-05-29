const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    login: (passcode) => ipcRenderer.invoke('auth:login', passcode),
    
    getAllInventory: () => ipcRenderer.invoke('inventory:get-all'),
    // Import/Export are triggered by main process menus, so no direct IPC needed from renderer for file picking itself.

    getAllActivities: () => ipcRenderer.invoke('activity:get-all'),
    logBorrow: (borrowData) => ipcRenderer.invoke('activity:log-borrow', borrowData),
    logStaffAction: (staffActionData) => ipcRenderer.invoke('activity:log-staff-action', staffActionData)
});
