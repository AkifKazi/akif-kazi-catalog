/**
 * Validates a borrow action and prepares data for logging.
 * @param {object} data - Details of the borrow action.
 * @param {number|string} data.userID - ID of the user borrowing.
 * @param {string} data.userName - Name of the user borrowing.
 * @param {string} [data.userSpecs] - Specs/details of the user.
 * @param {number|string} data.itemID - ID of the item to borrow.
 * @param {number} data.qtyToBorrow - Quantity of the item to borrow.
 * @param {string} [data.notes] - Optional notes for the borrow action.
 * @param {InventoryStore} inventoryStore - Instance of InventoryStore.
 * @returns {object} Result object { success, preparedActivityData?, error?, itemCurrentActualStock?, itemCurrentQtyRemaining?, currentQtyRemaining? (for error case) }.
 */
function validateAndPrepareBorrowAction(
    { userID, userName, userSpecs, itemID, qtyToBorrow, notes }, 
    inventoryStore
) {
    const numericItemID = Number(itemID);
    if (isNaN(numericItemID)) {
        return { success: false, error: "Invalid ItemID format." };
    }
    const item = inventoryStore.getItemById(numericItemID);

    if (!item) {
        return { success: false, error: "Item not found." };
    }

    const numQtyToBorrow = Number(qtyToBorrow);
    if (isNaN(numQtyToBorrow) || numQtyToBorrow <= 0) {
        return { success: false, error: "Borrow quantity must be a positive number." };
    }

    if (numQtyToBorrow > item.QtyRemaining) {
        return { 
            success: false, 
            error: `Cannot borrow ${numQtyToBorrow} items. Only ${item.QtyRemaining} currently available.`,
            currentQtyRemaining: item.QtyRemaining 
        };
    }

    const activityDataForLog = {
        Timestamp: new Date().toISOString(),
        Action: "Borrowed",
        UserID: Number(userID),
        UserName: String(userName),
        UserSpecs: String(userSpecs || ''), 
        ItemID: numericItemID, // Use the numeric version
        ItemName: String(item.ItemName), 
        ItemSpecs: String(item.ItemSpecs || ''), 
        Qty: numQtyToBorrow, 
        Notes: notes || "", 
        // ItemQtyRemainingAfterThisAction will be set in main.js
    };

    return { 
        success: true, 
        preparedActivityData: activityDataForLog, 
        itemCurrentActualStock: item.ActualStock, 
        itemCurrentQtyRemaining: item.QtyRemaining 
    };
}

/**
 * Validates a staff action (Returned, Used, Lost) and prepares data for logging.
 * @param {object} data - Details of the staff action.
 * @param {number|string} data.staffUserID - ID of the staff member.
 * @param {string} data.staffUserName - Name of the staff member.
 * @param {string} [data.staffUserSpecs] - Specs/details of the staff member.
 * @param {number|string} data.originalBorrowActivityID - ActivityID of the original borrow.
 * @param {number|string} data.itemID - ID of the item being processed.
 * @param {number} data.qtyProcessed - Quantity being processed.
 * @param {string} data.actionType - Type of action: "Returned", "Used", or "Lost".
 * @param {string} [data.notes] - Optional notes for the action.
 * @param {InventoryStore} inventoryStore - Instance of InventoryStore.
 * @param {ActivityStore} activityStore - Instance of ActivityStore.
 * @returns {object} Result object { success, preparedActivityData?, error? }.
 */
function validateAndPrepareStaffAction(
    { staffUserID, staffUserName, staffUserSpecs, originalBorrowActivityID, itemID, qtyProcessed, actionType, notes },
    inventoryStore,
    activityStore
) {
    const numericItemID = Number(itemID);
    if (isNaN(numericItemID)) {
        return { success: false, error: "Invalid ItemID format for staff action." };
    }
    const item = inventoryStore.getItemById(numericItemID);

    if (!item) {
        return { success: false, error: "Item not found for staff action." };
    }

    const numQtyProcessed = Number(qtyProcessed);
    if (isNaN(numQtyProcessed) || numQtyProcessed <= 0) {
        return { success: false, error: "Processed quantity must be a positive number." };
    }

    const numericOriginalBorrowActivityID = Number(originalBorrowActivityID);
    if (isNaN(numericOriginalBorrowActivityID)) {
        return { success: false, error: "Invalid Original Borrow ActivityID format." };
    }

    const allActivities = activityStore.getAllActivities();
    const originalBorrowLog = allActivities.find(
        act => Number(act.ActivityID) === numericOriginalBorrowActivityID && 
               Number(act.ItemID) === numericItemID && 
               act.Action === "Borrowed"
    );

    if (!originalBorrowLog) {
        return { success: false, error: `Original borrow record (ID: ${numericOriginalBorrowActivityID}) not found or does not match the item.` };
    }

    const alreadyProcessedQty = allActivities
        .filter(act => act.originalBorrowActivityID && Number(act.originalBorrowActivityID) === numericOriginalBorrowActivityID && 
                       (act.Action === "Returned" || act.Action === "Used" || act.Action === "Lost"))
        .reduce((sum, act) => sum + (Number(act.Qty) || 0), 0); // Ensure act.Qty is treated as number

    const originalBorrowedQty = Number(originalBorrowLog.Qty) || 0; // Ensure originalBorrowLog.Qty is treated as number
    const remainingToProcess = originalBorrowedQty - alreadyProcessedQty;

    if (numQtyProcessed > remainingToProcess) {
        return { 
            success: false, 
            error: `Cannot process ${numQtyProcessed} items. Only ${remainingToProcess} are pending action from borrow ${numericOriginalBorrowActivityID}.` 
        };
    }

    const activityDataForLog = {
        Timestamp: new Date().toISOString(),
        Action: actionType, 
        UserID: Number(staffUserID),
        UserName: String(staffUserName),
        UserSpecs: String(staffUserSpecs || ''),
        ItemID: numericItemID, // Use the numeric version
        ItemName: String(item.ItemName),
        ItemSpecs: String(item.ItemSpecs || ''),
        Qty: numQtyProcessed,
        Notes: notes || "",
        originalBorrowActivityID: numericOriginalBorrowActivityID, // Use the numeric version
        // ItemQtyRemainingAfterThisAction will be set in main.js
    };

    return { 
        success: true, 
        preparedActivityData: activityDataForLog 
    };
}

module.exports = {
    validateAndPrepareBorrowAction,
    validateAndPrepareStaffAction
};
