const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  getUsers: () => ipcRenderer.invoke("get-users")
});