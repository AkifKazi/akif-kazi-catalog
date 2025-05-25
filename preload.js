const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Inventory Store
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  getUsers: () => ipcRenderer.invoke("get-users"),
  updateItemStock: (itemID, quantityChange) => ipcRenderer.invoke("update-item-stock", itemID, quantityChange),

  // Activity Store
  addActivity: (entry) => ipcRenderer.invoke("add-activity", entry),
  getActivityLog: () => ipcRenderer.invoke("get-activity-log"),
  markItemUsed: (activityID) => ipcRenderer.invoke("mark-item-used", activityID),
  markItemLost: (activityID) => ipcRenderer.invoke("mark-item-lost", activityID),
  markItemReturned: (activityID) => ipcRenderer.invoke("mark-item-returned", activityID),
  exportActivity: () => ipcRenderer.invoke("export-activity-log")
});