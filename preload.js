const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  getUsers: () => ipcRenderer.invoke("get-users"),
  getActivityLog: () => ipcRenderer.invoke("get-activity"), // Added in a previous step, ensure it's here
  addActivity: (entry) => ipcRenderer.send("add-activity", entry), // Added in a previous step

  markItemUsed: async (userID, itemID) => {
    const result = await ipcRenderer.invoke("mark-item-used", userID, itemID);
    if (!result.success) {
      throw new Error(result.error || "Failed to mark item as used.");
    }
    return result;
  },

  markItemLost: async (userID, itemID) => {
    const result = await ipcRenderer.invoke("mark-item-lost", userID, itemID);
    if (!result.success) {
      throw new Error(result.error || "Failed to mark item as lost.");
    }
    return result;
  },

  returnItemsForUser: async (userID) => {
    const result = await ipcRenderer.invoke("return-items-for-user", userID);
    if (!result.success) {
      throw new Error(result.error || `Failed to return items for user ${userID}.`);
    }
    return result;
  }
});