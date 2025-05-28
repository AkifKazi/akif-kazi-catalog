const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Inventory Store
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  getUsers: () => ipcRenderer.invoke("get-users"),
  // updateItemStock was removed

  // Activity Store
  addActivity: (entry) => ipcRenderer.invoke("add-activity", entry), // For "Borrowed" actions
  getActivityLog: () => ipcRenderer.invoke("get-activity-log"),
  recordStaffAction: (details) => ipcRenderer.invoke("record-staff-action", details), // For "Returned", "Used", "Lost"
  exportActivity: () => ipcRenderer.invoke("export-activity-log")
});