let inventory = [];
let cart = [];
let suggestions = [];
let selectedIndex = -1;
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
document.getElementById("user-info").textContent = `${currentUser.UserName} ${currentUser.UserSpecs}`;
const fuse = new Fuse([], {
  keys: ["ItemName", "ItemSpecs", "Category"],
  threshold: 0.4
});

const searchInput = document.getElementById("search");
const suggestionsList = document.getElementById("suggestions");
const cartDiv = document.getElementById("cart");

window.electronAPI.getInventory().then(data => {
  inventory = data;
  fuse.setCollection(inventory);
});

// Debounce helper
let debounceTimeout;
function debounce(func, delay = 150) {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(func, delay);
}

searchInput.addEventListener("input", () => {
  debounce(() => {
    const value = searchInput.value.trim();
    if (value.length === 0) {
      suggestions = [];
      renderSuggestions();
      return;
    }

    const result = fuse.search(value).map(r => r.item);
    suggestions = result;
    selectedIndex = -1;
    renderSuggestions();
  });
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    if (suggestions.length > 0) {
      selectedIndex = (selectedIndex + 1) % suggestions.length;
      renderSuggestions();
      e.preventDefault();
    }
  }

  if (e.key === "ArrowUp") {
    if (suggestions.length > 0) {
      selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
      renderSuggestions();
      e.preventDefault();
    }
  }

  if (e.key === "Enter") {
    if (selectedIndex !== -1 && suggestions[selectedIndex]) {
      addToCart(suggestions[selectedIndex]);
      searchInput.value = "";
      suggestions = [];
      selectedIndex = -1;
      renderSuggestions();
      e.preventDefault();
    }
  }
});

function renderSuggestions() {
  suggestionsList.innerHTML = "";
  suggestions.forEach((item, idx) => {
    const li = document.createElement("li");
    li.textContent = `${item.ItemName} — ${item.ItemSpecs}`;
    if (item.Stock <= 0) {
      li.style.border = "1px solid red";
    }
    if (idx === selectedIndex) {
      li.classList.add("active");
    }
    suggestionsList.appendChild(li);
  });
}

function addToCart(item) {
  const found = cart.find(c => c.ItemID === item.ItemID);
  if (found) {
    if (found.quantity < item.Stock) {
      found.quantity++;
    } else {
      alert(`Max quantity reached (${item.Stock})`);
    }
  } else {
    if (item.Stock > 0) {
      cart.push({ ...item, quantity: 1 });
    } else {
      alert("Item is out of stock");
    }
  }
  renderCart();
}

function renderCart() {
  cartDiv.innerHTML = "";
  cart.forEach((item, idx) => {
    const div = document.createElement("div");
    div.classList.add("cart-item");
    div.innerHTML = `
      ${item.ItemName} (${item.ItemSpecs}) 
      <button onclick="updateQty(${idx}, -1)">-</button>
      <input value="${item.quantity}" onchange="manualQty(${idx}, this.value)" style="width: 40px;" />
      <button onclick="updateQty(${idx}, 1)" ${item.quantity >= item.Stock ? "disabled" : ""}>+</button>
      <button onclick="removeItem(${idx})">x</button>
    `;
    cartDiv.appendChild(div);
  });
}

function updateQty(index, delta) {
  const item = cart[index];
  const newQty = item.quantity + delta;
  if (newQty > item.Stock) {
    alert(`Max quantity is ${item.Stock}`);
  } else if (newQty <= 0) {
    cart.splice(index, 1);
  } else {
    item.quantity = newQty;
  }
  renderCart();
}

function manualQty(index, value) {
  const item = cart[index];
  let qty = parseInt(value);
  if (isNaN(qty) || qty <= 0) qty = 1;
  if (qty > item.Stock) {
    alert(`Max quantity is ${item.Stock}`);
    qty = item.Stock;
  }
  item.quantity = qty;
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  renderCart();
}

async function borrowItems() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) {
    alert("User not logged in. Redirecting to login page.");
    window.location.href = "login.html";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty. Please add items to borrow.");
    return;
  }

  const timestamp = new Date().toLocaleString();
  let allItemsProcessedSuccessfully = true;
  let borrowedItemsCount = 0;

  for (const cartItem of cart) {
    try {
      // 1. Update Stock
      // Ensure ItemID is passed as the correct type if necessary (e.g., Number(cartItem.ItemID))
      // For now, assuming ItemID is already in the correct format from inventory loading.
      const stockUpdateResult = await window.electronAPI.updateItemStock(cartItem.ItemID, -cartItem.quantity);
      if (!stockUpdateResult || !stockUpdateResult.success) {
        alert(`Failed to update stock for ${cartItem.ItemName}: ${stockUpdateResult.error || 'Unknown error during stock update.'}`);
        allItemsProcessedSuccessfully = false;
        break; // Stop processing further items
      }

      // 2. Add Activity Log
      const logEntry = {
        UserID: currentUser.UserID,
        UserName: currentUser.UserName,
        UserSpecs: currentUser.UserSpecs,
        Action: "Borrowed",
        ItemID: cartItem.ItemID, // Ensure this is the correct ID from the item object
        ItemName: cartItem.ItemName,
        ItemSpecs: cartItem.ItemSpecs,
        QtyChanged: -cartItem.quantity,
        QtyRemaining: stockUpdateResult.newStock, // Use newStock from the update result
        Timestamp: timestamp,
        Notes: "" // Or any other notes
      };
      const activityAddResult = await window.electronAPI.addActivity(logEntry);
      if (!activityAddResult || !activityAddResult.success) {
         alert(`Failed to log borrowing activity for ${cartItem.ItemName}: ${activityAddResult.error || 'Unknown error during activity logging.'}`);
         allItemsProcessedSuccessfully = false;
         // Optional: Implement logic to revert stock update for cartItem.ItemID if activity logging fails
         // For now, we stop and the stock for this item remains updated.
         break; 
      }
      borrowedItemsCount += cartItem.quantity;

    } catch (error) {
      console.error(`Error during borrowing process for item ${cartItem.ItemName}:`, error);
      alert(`An unexpected error occurred while borrowing ${cartItem.ItemName}. Please try again or contact support if the issue persists.`);
      allItemsProcessedSuccessfully = false;
      break;
    }
  }

  if (allItemsProcessedSuccessfully && cart.length > 0) {
    alert(`You’ve successfully borrowed ${borrowedItemsCount} items.`);
    cart = []; // Clear cart
    renderCart(); // Update UI
    
    // Logout
    localStorage.removeItem("currentUser");
    // Ensure user-info is cleared or updated if necessary
    const userInfoElement = document.getElementById("user-info");
    if(userInfoElement) userInfoElement.textContent = "No user logged in"; 

    window.location.href = "login.html";

  } else if (!allItemsProcessedSuccessfully && cart.length > 0) {
    // This case means some items might have been processed, some not.
    // The loop breaks on first error, so stock for subsequent items is not affected.
    // Activity for failed item is not logged.
    // User is already alerted about the specific error.
    // No full rollback implemented, so any prior successful stock updates/activity logs persist.
    // You might want to refresh inventory data here or guide user to check their activity.
    alert("Some items could not be processed. Please review your cart and try again, or check your activity log for details.");
    // Potentially refresh inventory to reflect any committed changes
    // window.electronAPI.getInventory().then(data => {
    //   inventory = data;
    //   fuse.setCollection(inventory);
    // });
  }
  // If cart was empty initially, the first check in the function handles it.
}
