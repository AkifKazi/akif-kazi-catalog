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
    // Use item.QtyRemaining from the inventory list
    if (item.QtyRemaining <= 0) {
      li.style.border = "1px solid red";
    }
    if (idx === selectedIndex) {
      li.classList.add("active");
    }
    suggestionsList.appendChild(li);
  });
}

function addToCart(item) {
  // 'item' here is from the main inventory list (suggestions)
  const foundInCart = cart.find(c => c.ItemID === item.ItemID);
  if (foundInCart) {
    // Use QtyRemaining from the item object stored in the cart for comparison
    if (foundInCart.quantity < foundInCart.QtyRemaining) {
      foundInCart.quantity++;
    } else {
      alert(`Max quantity reached (${foundInCart.QtyRemaining}) for ${foundInCart.ItemName}.`);
    }
  } else {
    // Use QtyRemaining from the inventory item for initial add
    if (item.QtyRemaining > 0) {
      // Store the item's current QtyRemaining in the cart item itself
      cart.push({ ...item, quantity: 1 }); // This copies ItemID, ItemName, ItemSpecs, and QtyRemaining
    } else {
      alert(`${item.ItemName} is out of stock.`);
    }
  }
  renderCart();
}

function renderCart() {
  cartDiv.innerHTML = "";
  cart.forEach((cartItem, idx) => { // cartItem here includes QtyRemaining
    const div = document.createElement("div");
    div.classList.add("cart-item");
    div.innerHTML = `
      ${cartItem.ItemName} (${cartItem.ItemSpecs}) 
      <button onclick="updateQty(${idx}, -1)">-</button>
      <input type="number" min="1" max="${cartItem.QtyRemaining}" value="${cartItem.quantity}" onchange="manualQty(${idx}, this.value)" style="width: 50px;" />
      <button onclick="updateQty(${idx}, 1)" ${cartItem.quantity >= cartItem.QtyRemaining ? "disabled" : ""}>+</button>
      <button onclick="removeItem(${idx})">x</button>
    `;
    cartDiv.appendChild(div);
  });
}

function updateQty(index, delta) {
  const cartItem = cart[index]; // cartItem includes QtyRemaining
  const newQty = cartItem.quantity + delta;

  if (newQty > cartItem.QtyRemaining) {
    alert(`Max quantity for ${cartItem.ItemName} is ${cartItem.QtyRemaining}.`);
  } else if (newQty <= 0) {
    cart.splice(index, 1); // Remove item if quantity is zero or less
  } else {
    cartItem.quantity = newQty;
  }
  renderCart();
}

function manualQty(index, value) {
  const cartItem = cart[index]; // cartItem includes QtyRemaining
  let qty = parseInt(value);

  if (isNaN(qty) || qty <= 0) {
    qty = 1; // Default to 1 if invalid input or less than 1
  }
  
  if (qty > cartItem.QtyRemaining) {
    alert(`Max quantity for ${cartItem.ItemName} is ${cartItem.QtyRemaining}. You entered ${value}.`);
    qty = cartItem.QtyRemaining; // Cap at max available
  }
  cartItem.quantity = qty;
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
      // Construct logEntry WITHOUT QtyRemaining.
      // Qty should be the positive quantity being borrowed.
      const logEntry = {
        UserID: currentUser.UserID,
        UserName: currentUser.UserName,
        UserSpecs: currentUser.UserSpecs,
        Action: "Borrowed",
        ItemID: cartItem.ItemID,
        ItemName: cartItem.ItemName,
        ItemSpecs: cartItem.ItemSpecs,
        Qty: cartItem.quantity, // Positive quantity borrowed
        Timestamp: timestamp,
        Notes: "" // Or any other notes
        // QtyRemaining is removed from here; main.js will handle it
      };

      // Call addActivity (which now internally handles inventory update first in main.js)
      const activityAddResult = await window.electronAPI.addActivity(logEntry);
      
      if (!activityAddResult || !activityAddResult.success) {
         alert(`Failed to process borrowing for ${cartItem.ItemName}: ${activityAddResult.error || 'Unknown error.'}`);
         allItemsProcessedSuccessfully = false;
         break; 
      }
      borrowedItemsCount += cartItem.quantity;

    } catch (error) {
      console.error(`Error during borrowing process for item ${cartItem.ItemName}:`, error);
      alert(`An unexpected error occurred while borrowing ${cartItem.ItemName}. Please try again or contact support.`);
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
    const userInfoElement = document.getElementById("user-info");
    if(userInfoElement) userInfoElement.textContent = "No user logged in"; 

    window.location.href = "login.html";

  } else if (!allItemsProcessedSuccessfully && cart.length > 0) {
    alert("Some items could not be processed. Please review your cart and try again, or check your activity log for details.");
    // Refresh inventory to reflect any committed changes and current QtyRemaining
    window.electronAPI.getInventory().then(data => {
      inventory = data;
      fuse.setCollection(inventory);
      // Optionally, you might want to re-validate cart items here against new inventory.
      // For now, just refreshing the main inventory list.
    });
  }
}
