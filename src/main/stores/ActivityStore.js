const fs = require('fs');
const path = require('path');

class ActivityStore {
    constructor(app) {
        this.userDataPath = app.getPath('userData');
        this.filePath = path.join(this.userDataPath, 'activityLog.json');
        this.activityLog = this._loadData();
        this.nextActivityId = this._initializeNextActivityId();
        console.log(`ActivityStore initialized. Path: ${this.filePath}. Logs loaded: ${this.activityLog.length}. Next ID: ${this.nextActivityId}`);
    }

    _loadData() {
        try {
            if (fs.existsSync(this.filePath)) {
                const rawData = fs.readFileSync(this.filePath);
                if (rawData.length === 0) {
                    console.warn('activityLog.json is empty. Initializing with empty array.');
                    return [];
                }
                return JSON.parse(rawData);
            }
            console.warn('activityLog.json not found. Initializing with empty array.');
            return [];
        } catch (error) {
            console.error('Error loading activityLog.json:', error.message, '. Initializing with empty array.');
            return [];
        }
    }

    _saveData() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.activityLog, null, 2));
        } catch (error) {
            console.error('Error saving activityLog.json:', error.message);
        }
    }

    _initializeNextActivityId() {
        if (!this.activityLog || this.activityLog.length === 0) {
            return 1;
        }
        const maxId = Math.max(0, ...this.activityLog.map(activity => Number(activity.ActivityID) || 0));
        return maxId + 1;
    }

    addActivity(activityData) {
        // Expected fields in activityData:
        // Timestamp, Action, UserID, UserName, UserSpecs, 
        // ItemID, ItemName, ItemSpecs (of item), 
        // Qty (positive), Notes (optional), ItemQtyRemainingAfterThisAction,
        // originalBorrowActivityID (optional, for staff actions)
        const newActivity = {
            ActivityID: this.nextActivityId++,
            Timestamp: activityData.Timestamp || new Date().toISOString(),
            Action: String(activityData.Action),
            UserID: Number(activityData.UserID),
            UserName: String(activityData.UserName),
            UserSpecs: String(activityData.UserSpecs || ''),
            ItemID: Number(activityData.ItemID),
            ItemName: String(activityData.ItemName),
            ItemSpecs: String(activityData.ItemSpecs || ''), // Item's specs
            Qty: Math.abs(Number(activityData.Qty || 0)), // Ensure positive
            Notes: String(activityData.Notes || ''),
            ItemQtyRemainingAfterThisAction: Number(activityData.ItemQtyRemainingAfterThisAction),
            originalBorrowActivityID: activityData.originalBorrowActivityID // Will be undefined if not present
        };
        this.activityLog.push(newActivity);
        this._saveData();
        return newActivity;
    }

    getAllActivities() {
        return this.activityLog;
    }
}

module.exports = ActivityStore;
