const XLSX = require('xlsx');

// Helper function for case-insensitive key finding
function findValueByKeyCaseInsensitive(obj, key) {
    if (!obj || typeof obj !== 'object' || !key) {
        return undefined;
    }
    const objKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return objKey ? obj[objKey] : undefined;
}

async function importUsersFromExcel(filePath, userStore) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const importedUsers = [];
        const skippedRows = [];

        jsonData.forEach((row, index) => {
            const rawUserID = findValueByKeyCaseInsensitive(row, 'UserID');
            const rawUserName = findValueByKeyCaseInsensitive(row, 'UserName');
            const rawRole = findValueByKeyCaseInsensitive(row, 'Role');
            const rawUserSpecs = findValueByKeyCaseInsensitive(row, 'UserSpecs');
            const rawPasscode = findValueByKeyCaseInsensitive(row, 'Passcode');

            let validationError = null;
            let normalizedRole = '';

            if (rawUserID === undefined || rawUserID === null || String(rawUserID).trim() === '') validationError = 'UserID is missing.';
            else if (isNaN(Number(rawUserID))) validationError = 'UserID must be a number.';
            
            if (!rawUserName && !validationError) validationError = 'UserName is missing.';
            
            if (!rawRole && !validationError) {
                validationError = 'Role is missing.';
            } else if (!validationError) {
                const roleStr = String(rawRole).trim().toLowerCase();
                if (roleStr === 'student') normalizedRole = 'Student';
                else if (roleStr === 'staff') normalizedRole = 'Staff';
                else validationError = 'Role must be "Student" or "Staff".';
            }
            
            if (!rawPasscode && !validationError) validationError = 'Passcode is missing.';

            if (!validationError) {
                const passcodeStr = String(rawPasscode).trim();
                if (normalizedRole === "Student") {
                    if (!/^[0-9]{4}$/.test(passcodeStr)) {
                        validationError = 'Student Passcode must be a 4-digit number.';
                    }
                } else if (normalizedRole === "Staff") {
                    if (!/^[a-zA-Z0-9]{6}$/.test(passcodeStr)) {
                        validationError = 'Staff Passcode must be a 6-character alphanumeric string.';
                    }
                }
            }

            if (validationError) {
                const skippedRowInfo = { rowNumber: index + 2, data: row, error: validationError };
                console.warn(`Skipping user row ${skippedRowInfo.rowNumber}: ${validationError} - Data: ${JSON.stringify(row)}`);
                skippedRows.push(skippedRowInfo);
            } else {
                importedUsers.push({
                    UserID: Number(rawUserID),
                    UserName: String(rawUserName).trim(),
                    Role: normalizedRole,
                    UserSpecs: String(rawUserSpecs || '').trim(),
                    Passcode: String(rawPasscode).trim()
                });
            }
        });

        if (importedUsers.length > 0) {
            userStore.setUsers(importedUsers);
        }

        return { 
            success: true, 
            importedCount: importedUsers.length, 
            skippedCount: skippedRows.length, 
            skippedRowsInfo: skippedRows 
        };

    } catch (error) {
        console.error('Error importing users from Excel:', error);
        return { success: false, error: error.message };
    }
}

async function importInventoryFromExcel(filePath, inventoryStore) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const importedInventory = [];
        const skippedRows = [];

        jsonData.forEach((row, index) => {
            const rawItemID = findValueByKeyCaseInsensitive(row, 'ItemID');
            const rawItemName = findValueByKeyCaseInsensitive(row, 'ItemName');
            const rawItemSpecs = findValueByKeyCaseInsensitive(row, 'ItemSpecs');
            const rawCategory = findValueByKeyCaseInsensitive(row, 'Category');
            const rawStock = findValueByKeyCaseInsensitive(row, 'Stock');

            let validationError = null;

            if (rawItemID === undefined || rawItemID === null || String(rawItemID).trim() === '') validationError = 'ItemID is missing.';
            else if (isNaN(Number(rawItemID))) validationError = 'ItemID must be a number.';
            
            if (!rawItemName && !validationError) validationError = 'ItemName is missing.';
            
            if (rawStock === undefined || rawStock === null || String(rawStock).trim() === '') {
                 if (!validationError) validationError = 'Stock is missing.';
            } else if (isNaN(Number(rawStock)) || Number(rawStock) < 0) {
                 if (!validationError) validationError = 'Stock must be a non-negative number.';
            }


            if (validationError) {
                const skippedRowInfo = { rowNumber: index + 2, data: row, error: validationError };
                console.warn(`Skipping inventory row ${skippedRowInfo.rowNumber}: ${validationError} - Data: ${JSON.stringify(row)}`);
                skippedRows.push(skippedRowInfo);
            } else {
                const stockNum = Number(rawStock);
                importedInventory.push({
                    ItemID: Number(rawItemID),
                    ItemName: String(rawItemName).trim(),
                    ItemSpecs: String(rawItemSpecs || '').trim(),
                    Category: String(rawCategory || '').trim(),
                    InitialStock: stockNum,
                    ActualStock: stockNum, 
                    QtyRemaining: stockNum 
                });
            }
        });

        if (importedInventory.length > 0) {
            inventoryStore.setInventory(importedInventory);
        }

        return { 
            success: true, 
            importedCount: importedInventory.length, 
            skippedCount: skippedRows.length, 
            skippedRowsInfo: skippedRows 
        };

    } catch (error) {
        console.error('Error importing inventory from Excel:', error);
        return { success: false, error: error.message };
    }
}

async function exportActivityLogToExcel(filePath, activityEntries) {
    try {
        if (!activityEntries || activityEntries.length === 0) {
            return { success: false, error: "No activity data to export." };
        }

        const dataForSheet = activityEntries.map(entry => ({
            ActivityID: entry.ActivityID,
            Timestamp: entry.Timestamp,
            Action: entry.Action,
            ItemID: entry.ItemID,
            ItemName: entry.ItemName,
            ItemSpecs: entry.ItemSpecs || '',
            Qty: Math.abs(Number(entry.Qty || 0)), 
            UserID: entry.UserID, 
            UserName: entry.UserName,
            UserSpecs: entry.UserSpecs || '',
            Notes: entry.Notes || '',
            ItemQtyRemainingAfterThisAction: entry.ItemQtyRemainingAfterThisAction,
            OriginalBorrowActivityID: entry.originalBorrowActivityID || ''
        }));
        
        const headers = [
            "ActivityID", "Timestamp", "Action", "ItemID", "ItemName", "ItemSpecs", 
            "Qty", "UserID", "UserName", "UserSpecs", "Notes", 
            "ItemQtyRemainingAfterThisAction", "OriginalBorrowActivityID"
        ];

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ActivityLog"); // Changed sheet name

        XLSX.writeFile(workbook, filePath);
        return { success: true, filePath: filePath };

    } catch (error) {
        console.error('Error exporting activity log to Excel:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    importUsersFromExcel,
    importInventoryFromExcel,
    exportActivityLogToExcel
};
