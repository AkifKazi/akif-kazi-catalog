const fs = require('fs');
const path = require('path');

class InventoryStore {
    constructor(app) {
        this.userDataPath = app.getPath('userData');
        this.filePath = path.join(this.userDataPath, 'inventory.json');
        this.inventory = this._loadData();
        console.log(`InventoryStore initialized. Path: ${this.filePath}. Items loaded: ${this.inventory.length}`);
    }

    _loadData() {
        try {
            if (fs.existsSync(this.filePath)) {
                const rawData = fs.readFileSync(this.filePath);
                 if (rawData.length === 0) {
                    console.warn('inventory.json is empty. Initializing with empty array.');
                    return [];
                }
                return JSON.parse(rawData);
            }
            console.warn('inventory.json not found. Initializing with empty array.');
            return [];
        } catch (error) {
            console.error('Error loading inventory.json:', error.message, '. Initializing with empty array.');
            return [];
        }
    }

    _saveData() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.inventory, null, 2));
        } catch (error) { // Added curly brace for the catch block
            console.error('Error saving inventory.json:', error.message);
        }
    }

    getInventory() {
        return this.inventory;
    }

    getItemById(itemID) {
        const numericItemID = Number(itemID);
        return this.inventory.find(item => Number(item.ItemID) === numericItemID);
    }

    // This is the primary method for updating an item's dynamic stock fields
    recalculateAndSaveItemState(itemID, fullActivityLog) {
        const numericItemID = Number(itemID);
        const itemIndex = this.inventory.findIndex(item => Number(item.ItemID) === numericItemID);

        if (itemIndex === -1) {
            console.warn(`InventoryStore: Item with ID ${numericItemID} not found for recalculation.`); // Added console.warn
            return { success: false, error: `Item with ID ${itemID} not found for recalculation.` };
        }

        const item = this.inventory[itemIndex];
        item.InitialStock = Number(item.InitialStock || 0); // Ensure InitialStock is a number

        const relevantEntries = fullActivityLog.filter(entry => Number(entry.ItemID) === numericItemID);

        const totalUsedOrLost = relevantEntries
            .filter(entry => entry.Action === "Used" || entry.Action === "Lost")
            .reduce((sum, entry) => sum + Math.abs(Number(entry.Qty || 0)), 0);

        item.ActualStock = item.InitialStock - totalUsedOrLost;
        if (item.ActualStock < 0) item.ActualStock = 0;

        const totalBorrowed = relevantEntries
            .filter(entry => entry.Action === "Borrowed")
            .reduce((sum, entry) => sum + Math.abs(Number(entry.Qty || 0)), 0);

        const totalReturned = relevantEntries
            .filter(entry => entry.Action === "Returned")
            .reduce((sum, entry) => sum + Math.abs(Number(entry.Qty || 0)), 0);
        
        const netBorrowed = totalBorrowed - totalReturned;
        item.QtyRemaining = item.ActualStock - netBorrowed;

        if (item.QtyRemaining < 0) item.QtyRemaining = 0;
        if (item.QtyRemaining > item.ActualStock) item.QtyRemaining = item.ActualStock;
        
        this.inventory[itemIndex] = item; // Update the item in the array
        this._saveData();
        return { success: true, updatedItem: { ...item } }; // Return a copy
    }
    
    // Used by Excel import - replaces entire inventory
    setInventory(inventoryData) {
        this.inventory = inventoryData.map(item => ({
            ItemID: Number(item.ItemID),
            ItemName: String(item.ItemName),
            ItemSpecs: String(item.ItemSpecs || ''),
            Category: String(item.Category || ''),
            InitialStock: Number(item.InitialStock || 0),
            ActualStock: Number(item.ActualStock !== undefined ? item.ActualStock : (item.InitialStock || 0)),
            QtyRemaining: Number(item.QtyRemaining !== undefined ? item.QtyRemaining : (item.InitialStock || 0))
        }));
        this._saveData();
    }
}

module.exports = InventoryStore;
