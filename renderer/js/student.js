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

function borrowItems() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const timestamp = new Date().toLocaleString();

  cart.forEach(item => {
    const logEntry = {
      UserID: currentUser.UserID,
      UserName: currentUser.UserName,
      UserSpecs: currentUser.UserSpecs,
      Action: "Borrowed",
      ItemID: item.ItemID,
      ItemName: item.ItemName,
      ItemSpecs: item.ItemSpecs,
      QtyChanged: -item.quantity,
      QtyRemaining: item.Stock - item.quantity,
      Timestamp: timestamp,
      Notes: ""
    };

    window.electronAPI.addActivity(logEntry);
  });

  alert(`You’ve borrowed ${cart.reduce((sum, i) => sum + i.quantity, 0)} items`);
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}
