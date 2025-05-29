const fs = require('fs');
const path = require('path');

class UserStore {
    constructor(app) {
        this.userDataPath = app.getPath('userData');
        this.filePath = path.join(this.userDataPath, 'users.json');
        this.users = this._loadData();
        console.log(`UserStore initialized. Path: ${this.filePath}. Users loaded: ${this.users.length}`);
    }

    _loadData() {
        try {
            if (fs.existsSync(this.filePath)) {
                const rawData = fs.readFileSync(this.filePath);
                if (rawData.length === 0) { // Handle empty file
                    console.warn('users.json is empty. Initializing with empty array.');
                    return [];
                }
                return JSON.parse(rawData);
            }
            console.warn('users.json not found. Initializing with empty array.');
            return [];
        } catch (error) {
            console.error('Error loading users.json:', error.message, '. Initializing with empty array.');
            return []; 
        }
    }

    _saveData() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users.json:', error.message);
        }
    }

    getAllUsers() {
        return this.users;
    }

    findUserByPasscode(passcode) {
        const searchTerm = String(passcode);
        return this.users.find(user => String(user.Passcode) === searchTerm);
    }
    
    setUsers(usersData) {
        this.users = usersData.map(user => ({
            UserID: Number(user.UserID), 
            UserName: String(user.UserName),
            Role: String(user.Role), 
            UserSpecs: String(user.UserSpecs || ''), // Add UserSpecs as per previous logs
            Passcode: String(user.Passcode)
        }));
        this._saveData();
    }
}

module.exports = UserStore;
