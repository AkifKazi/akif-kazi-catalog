Catalog is an inventory logging app made for small scale educational setting. its gonna be used by design students who borrow design materials, tools and books from their college. the app is gonna be made on electron with node.js, and will be available on both macos and windows. the app will have 3 interfaces- login, student and staff. the students will be given a 4 digit numeric secret code, meanwhile the staff will be given a 6 digit alphanumeric secret code. these code will be entered on the login screen which shows the interface and its data appropriately to each user. the student interface will be used by students to search and borrow items, they can also change the quantity from the interface as well. the borrowed items show up in the staff interface in which the staff marks the items returned to them as 'Confirmed', they can also manually change the items returned number. there is a strong backend which syncs both the student and staff interfaces together, making sure they work harmoniously.

there are 4 main functions of the app:
- importing excel files for master inventory and user data
- searching and browsing the inventory files from the student interface logged in using the user data
- saving all activity of borrowing and returning in the backend and having everything properly synced
- exporting activity to excel format from the app itself

the 2 excel files which are imported are:
Inventory.xlsx, which has these columns in order- "ItemID" (3 digit numeric identification tag for each item), "ItemName" (name of the item),	"ItemSpecs" (extra details of the item),	"Category" (category of item),	"Stock" (total quantity of an item),	"RestockThreshold" (quantity of item below which you need to restock),	"LastRestock" (date in dd/mm/yy format for the last restock of an item), "UnitPrice" (price of an item of a single quantity),	"StockValue" (total cost of stock which is a multiple of stock and unitprice).

Users.xlsx, which has these columns in order- "UserID" (3 digit numeric identifier tag for each user), "UserName" (first and last name of the user), "Role" (either student or staff, role determines the secret code as well), "UserSpecs" (details about the user), "Passcode" (secret code given to the user by the college).

the 1 excel file which is exported has the following columns in order- "Student ID" (3 digit id tag of the student), "Name" (first and last name of the student), "Batch" (the extra details of the student), "Returned" (quantity of items marked as returned by the staff), "Borrowed" (quantity of items borrowed by the student), "Item" (name of the item), "Details" (extra details about the item), "Borrow Timestamp" (timestamp with date of when the item was borrowed by the student), "Returned Timestamp" (timestamp with date of when the item was marked as returned by the staff), "Notes" (optional small notes made by the staff). 

backend:
the app will store the inventory master excel file data and user data locally for quick access. the app will also be logging down each borrow and return activity, however in the excel export it will only include the return activity with borrow timestamp and quantity included. in the backend there are 2 important item quantities- InitialStock and AvailableStock. 

logic:
initial stock is the item quantity which was imported from the excel inventory master file initially, however it will be updated when there are items which havent been returned. so it will not be updated unless there is/are quantity of items which havent been returned (quantity of items borrowed - quantity of items returned). the available stock is the item quantity which gets updated through every borrow and return activity. borrowing items removes the borrowed quantity from the available stock and returning adds them back. hence the available stock would be less than the initial stock if any item has been borrowed, but once all items are returned then the available stock will be equal to the initial stock. once the initial stock < the stock threshold then there will be a simple alert in the staff interface reminding the staff to restock. if a user borrows the entire available stock then the next user (and even themselves) logically shouldnt be able to borrow more of that item as now the available stock will be zero. only if the borrower returns can that item be borrowed again.

frontend:
login interface will be having a png logo of the app, a text field for the secret code which doesnt show the text but uses elipses to hide it. the student interface has a search field on the top left with the student details on the right side and the borrow button on the top right side. below the student details and the borrow button we have the cart which hosts all the items selected from the search area results. the student will start typing and the search results will show up, the student can then use keyboard navigation for effiecnt and quick selection of items. these selected items in the cart can be removed individually and also their quanitity can be changes through plus and minus buttons or by using the numerical field. the staff interface has the staff details on top left with the logout button on the top right. below these we have the borrow activity entries arranged oldest first. you can see the student details, item details, time stamp of borrowing, a number field to enter the quantity returned (defualt filled with the quantity borrowed), and a non editable quantity borrowed and finally a notes text field. the staff needs to click the "Confirm" button beside each entry to mark it as checked and confirmed. only these confirmed entries can now be exported as excel files. exporting can be done through the menu bar/app bar which also allows the importing of inventory and user excel files, along with the option to logout of the student/staff interface. 


# Catalog – Inventory Logging App for Design Students

## Overview

**Catalog** is a desktop-based inventory logging and tracking application designed for small-scale educational settings, primarily used by design students to borrow materials, tools, and books from their college. It is built using **Electron**, **Node.js**, **HTML/CSS/JavaScript**, and uses **fuzzy search** and **xlsx** libraries when needed. The app supports **macOS** and **Windows** platforms.

## Key Features

* Cross-platform desktop app (Electron)
* Local Excel file import/export
* Fuzzy search for inventory browsing
* Borrowing and returning system with synced backend logic
* Role-based login with 4-digit (students) and 6-character (staff) secret codes

---

## User Interfaces

### 1. Login Screen

* Displays app logo (`.png`)
* Single password input field:

  * Masked input (ellipses instead of text)
* Passcode input logic:

  * 4-digit numeric for Students
  * 6-character alphanumeric for Staff
* Role determined based on matching passcode from Users.xlsx
* Successful login redirects to:

  * **Student Interface** for students
  * **Staff Interface** for staff

---

### 2. Student Interface

* Top Left: Search field with fuzzy search
* Top Right: Borrow button
* Right Side: Logged-in student details
* Main Section: Cart

  * Items added from search
  * Each item row has:

    * Name and specs
    * Quantity controls (plus/minus buttons and number input)
    * Remove button
* Keyboard navigation for search and selection
* Validates quantity does not exceed available stock
* Borrow button saves activity and updates backend stock values

---

### 3. Staff Interface

* Top Left: Staff details
* Top Right: Logout button
* Below: Borrow activity list (chronological, oldest first)
* Each borrow activity row includes:

  * Student ID and name
  * Item name and specs
  * Borrowed quantity (non-editable)
  * Returned quantity (editable field, pre-filled)
  * Notes field (optional)
  * Confirm button to finalize return
* Menu bar contains:

  * Import Inventory: Load inventory Excel files
  * Import Users: Load user Excel files
  * Export: Save confirmed return activities to Excel
  * Logout option

---

## App Logic

### Backend Data Sync

* Both Student and Staff interfaces operate on a shared backend state
* Borrow and return actions are instantly reflected across both interfaces

### Inventory Logic

* Two internal stock counters:

  * `InitialStock`: Original stock from Inventory.xlsx, updated **only if** unreturned items exist across sessions
  * `AvailableStock`: Live stock, updated on every borrow/return action
  * AvailableStock = InitialStock - quantity of Unreturned items
  * quantity of Unreturned items = quantity of items borrowed - quantity of items returned
* Borrowing:

  * Reduces `AvailableStock`
  * If `AvailableStock == 0`, item cannot be borrowed further
  * max quantity borrowable by student is whichever one is lesser of AvailableStock and InitialStock. if AvailableStock < InitialStock then that will be used as max, else InitialStock will be used.
* Returning:

  * Increases `AvailableStock`
* Alert on Staff Interface:

  * If `InitialStock < RestockThreshold`, show simple alert to restock

---

## Excel Files and Data Structure

### 1. Inventory Import: `Inventory.xlsx`

| Column Name      | Description                        |
| ---------------- | ---------------------------------- |
| ItemID           | 3-digit numeric ID                 |
| ItemName         | Name of the item                   |
| ItemSpecs        | Extra details or specs             |
| Category         | Type/category of item              |
| Stock            | Total quantity available           |
| RestockThreshold | Threshold to trigger restock alert |
| LastRestock      | Date of last restock (dd/mm/yy)    |
| UnitPrice        | Price per unit                     |
| StockValue       | Total value = Stock × UnitPrice    |

### 2. User Import: `Users.xlsx`

| Column Name | Description                                                                    |
| ----------- | ------------------------------------------------------------------------------ |
| UserID      | 3-digit numeric identifier                                                     |
| UserName    | First and last name of the user                                                |
| Role        | `student` or `staff`                                                           |
| UserSpecs   | Additional user metadata (e.g., batch name for students, department for staff) |
| Passcode    | Secret code (4-digit for students, 6-char alphanumeric for staff)              |

### 3. Activity Export: `ActivityLog.xlsx`

| Column Name        | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Student ID         | 3-digit ID of the student                             |
| Name               | Full name of the student                              |
| Batch              | Metadata from UserSpecs                               |
| Returned           | Quantity of items marked as returned by staff         |
| Borrowed           | Quantity of items borrowed                            |
| Item               | Name of the item                                      |
| Details            | ItemSpecs                                             |
| Borrow Timestamp   | Date & time when item was borrowed                    |
| Returned Timestamp | Date & time when item was confirmed returned by staff |
| Notes              | Optional comments by staff                            |

---

## Functional Requirements

### 1. Importing Excel Files

* `Inventory.xlsx` and `Users.xlsx` are selected and loaded through the menu
* Parses Excel to JSON on load
* Errors in format prompt alerts

### 2. Searching and Borrowing

* Student uses fuzzy search
* Cart system with live quantity checks
* Quantity cannot exceed `AvailableStock`
* Borrow action:

  * Creates borrow log entry
  * Updates `AvailableStock`

### 3. Returning and Confirmation

* Staff sees all borrow entries
* Quantity returned can be edited before confirmation
* Once "Confirm" is clicked:

  * Marks the entry as returned
  * Updates `AvailableStock`
  * Saves `ReturnedTimestamp`
  * Only confirmed entries are included in export

### 4. Exporting Activity

* Staff can export all confirmed return entries to Excel
* Exported file matches column structure above
* Export from menu bar

---

## Backend Architecture

* Local JSON-based in-memory storage derived from Excel imports
* Borrow/return logs stored and updated in app memory
* All actions synced across student and staff interface sessions
* App can work offline after import (no server needed)

---


* Activity timestamps include both **date and time**
* Quantity inputs prevent invalid or negative values
* Alerts when:

  * Borrowing more than available (student interface)
  * Stock drops below restock threshold (staff interface)
