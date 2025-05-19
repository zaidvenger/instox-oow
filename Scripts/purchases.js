// purchases.js

// Ensure only brokers or admins can access
window.onload = async () => {
    if (!initPage()) return;

    const role = getRole();
    if (role !== "broker" && role !== "admin") {
        alert("Access denied. Only brokers and admins can access this page.");
        window.location.href = "index.html";
        return;
    }

    const currentUser = getUser();

    // Populate both Buy From and Sell To dropdowns with traders
    const buyFromDropdown = document.getElementById("buyFromUser");
    const sellToDropdown = document.getElementById("sellToUser");
    const allUsers = await getAllTeams();
    const traders = allUsers.filter(user => user.role === "trader");
    
    // Add blank default options
    buyFromDropdown.add(new Option("Select Team to BUY FROM", ""));
    sellToDropdown.add(new Option("Select Team to SELL TO", ""));
    
    traders.forEach((user) => {
        if (user.username !== currentUser) {
            // Add to Buy From dropdown
            const buyOption = document.createElement("option");
            buyOption.value = user.username;
            buyOption.text = user.username;
            buyFromDropdown.add(buyOption);

            // Add to Sell To dropdown
            const sellOption = document.createElement("option");
            sellOption.value = user.username;
            sellOption.text = user.username;
            sellToDropdown.add(sellOption);
        }
    });

    // Display current balance for selected participant
    await updateBalanceDisplay();

    // Setup input sanitization
    document.getElementById("price").addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9.]/g, "");
    });
    document.getElementById("quantity").addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9]/g, "");
    });

    // Setup participant dropdown with only traders
    const participantSelect = document.getElementById("participantSelect");
    const participantWarning = document.getElementById("participantWarning");

    traders.forEach((user) => {
        const opt = document.createElement("option");
        opt.value = user.username;
        opt.text = user.username;
        participantSelect.appendChild(opt);
    });

    // Set initial state of Buy button
    const buyButton = document.getElementById("buyButton");
    buyButton.disabled = !participantSelect.value;

    const selected = getCurrentParticipant();
    if (selected) participantSelect.value = selected;

    participantSelect.addEventListener("change", function () {
        setCurrentParticipant(this.value);
        participantWarning.style.display = this.value ? "none" : "block";
        updateBalanceDisplay();

        buyButton.disabled = !this.value;
        if (buyButton.disabled) {
            buyButton.classList.add("disabled-gray");
        } else {
            buyButton.classList.remove("disabled-gray");
        }
    });

    if (!participantSelect.value) participantWarning.style.display = "block";

    await populateStockDropdown();
    await populateIPODropdown();
};

async function populateStockDropdown() {
    const { data: companies, error } = await supabase.from("ipo").select("company");
    const stockSelect = document.getElementById("stockSelect");
    stockSelect.innerHTML = ""; // Clear existing
    if (companies) {
        companies.forEach(({ company }) => {
            const option = document.createElement("option");
            option.value = company;
            option.text = company;
            stockSelect.appendChild(option);
        });
    }
}

// Populate IPO dropdown
async function populateIPODropdown() {
    const { data: companies, error } = await supabase.from("ipo").select("company");
    if (error) {
        console.error("Error fetching IPO companies:", error);
        return;
    }
    const ipoStockSelect = document.getElementById("ipoStockSelect");
    ipoStockSelect.innerHTML = "";
    if (companies) {
        companies.forEach(({ company }) => {
            const option = document.createElement("option");
            option.value = company;
            option.text = company;
            ipoStockSelect.appendChild(option);
        });
    }
    // No price to set automatically, so clear or leave ipoPrice as is
    document.getElementById("ipoPrice").value = "";
}

// Buy stock (for a participant, not IPO)
async function buyStock() {
    const participant = getCurrentParticipant();
    if (!participant) {
        document.getElementById("participantWarning").style.display = "block";
        return;
    }

    const stock = document.getElementById("stockSelect").value;
    const price = parseFloat(document.getElementById("price").value);
    const quantity = parseInt(document.getElementById("quantity").value);
    const fromUser = document.getElementById("buyFromUser").value;

    if (!fromUser) {
        showPopup("Please select a trader to buy from.", "error");
        return;
    }

    if (!validateTradeInputs(price, quantity)) return;

    const totalCost = price * quantity;

    // Check if buyer has enough funds
    if (!(await canAffordPurchase(participant, totalCost))) {
        showPopup(
            `Cannot buy stocks. Insufficient funds. You need ${formatCurrency(totalCost)}.`,
            "error"
        );
        return;
    }

    // Check if seller has enough stocks
    const sellerStocks = await getAvailableStockQuantity(fromUser, stock);
    if (sellerStocks < quantity) {
        showPopup(
            `Seller only has ${sellerStocks} shares of ${stock} available.`,
            "error"
        );
        return;
    }

    if (!confirmAction(`Buy ${quantity} of ${stock} from ${fromUser} at ${formatCurrency(price)} each?`)) return;

    const timestamp = new Date().toISOString();

    // Get buyer and seller IDs
    const { data: buyerUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", participant)
        .single();
    const { data: sellerUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", fromUser)
        .single();

    if (!buyerUser || !sellerUser) return showPopup("Buyer or seller not found.", "error");

    // Insert both buy and sell transactions
    const { error } = await supabase.from("transactions").insert([
        {
            user_id: buyerUser.id,
            stock,
            price,
            quantity,
            type: "buy",
            counterparty: fromUser,
            timestamp: timestamp
        },
        {
            user_id: sellerUser.id,
            stock,
            price,
            quantity,
            type: "sell",
            counterparty: participant,
            timestamp: timestamp
        }
    ]);

    if (error) {
        console.error(error);
        return showPopup("Error recording transaction.", "error");
    }

    showPopup(
        `Successfully bought ${quantity} of ${stock} from ${fromUser} at ${formatCurrency(price)}.`,
        "success"
    );
    updateBalanceDisplay();
}

// Sell stock
async function sellStock() {
    const participant = getCurrentParticipant();
    if (!participant) {
        document.getElementById("participantWarning").style.display = "block";
        return;
    }

    const stock = document.getElementById("stockSelect").value;
    const price = parseFloat(document.getElementById("price").value);
    const quantity = parseInt(document.getElementById("quantity").value);
    const toUser = document.getElementById("sellToUser").value;

    if (!validateTradeInputs(price, quantity)) return;

    const totalCost = price * quantity;

    const available = await getAvailableStockQuantity(participant, stock);
    if (quantity > available) {
        return showPopup(`You only have ${available} of ${stock}.`, "error");
    }

    if (!(await canAffordPurchase(toUser, totalCost))) {
        return showPopup("Buyer has insufficient funds.", "error");
    }

    if (
        !confirmAction(
            `Sell ${quantity} of ${stock} to ${toUser} at ${formatCurrency(price)} each?`
        )
    )
        return;

    const { data: sellerUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", participant)
        .single();
    const { data: buyerUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", toUser)
        .single();
    if (!sellerUser || !buyerUser) return showPopup("Seller or buyer not found.", "error");

    const timestamp = new Date().toISOString();

    const { error: sellError } = await supabase.from("transactions").insert([
        {
            user_id: sellerUser.id,
            stock,
            price,
            quantity,
            type: "sell",
            counterparty: toUser,
            timestamp: timestamp,
        },
        {
            user_id: buyerUser.id,
            stock,
            price,
            quantity,
            type: "buy",
            counterparty: participant,
            timestamp: timestamp,
        },
    ]);

    if (sellError) {
        console.error(sellError);
        return showPopup("Failed to complete sale.", "error");
    }

    showPopup(`Sold ${quantity} of ${stock} to ${toUser} at ${formatCurrency(price)}.`, "success");
    updateBalanceDisplay();
}

// Buy from IPO (for selected participant)
async function buyFromIPO() {
    const participant = getCurrentParticipant();
    if (!participant) {
        showPopup("Please select a participant to buy IPO shares for.", "error");
        return;
    }
    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("username", participant)
        .single();
    if (!user) return showPopup("Participant not found.", "error");

    const stock = document.getElementById("ipoStockSelect").value;
    const price = parseFloat(document.getElementById("ipoPrice").value);
    const quantity = parseInt(document.getElementById("ipoQuantity").value);

    if (!validateTradeInputs(price, quantity)) return;

    // Check IPO shares available
    const { data: ipoData } = await supabase
        .from("ipo")
        .select("total_shares, shares_sold")
        .eq("company", stock)
        .single();
    const available = ipoData.total_shares - ipoData.shares_sold;
    if (quantity > available) {
        return showPopup(`Only ${available} shares available in IPO for ${stock}.`, "error");
    }

    // Check participant's balance
    if (!(await canAffordPurchase(participant, price * quantity))) {
        return showPopup("Insufficient funds.", "error");
    }

    // Insert transaction for the participant
    const { error } = await supabase.from("transactions").insert([
        {
            user_id: user.id,
            stock,
            price,
            quantity,
            type: "buy",
            timestamp: new Date().toISOString(),
            counterparty: "IPO",
        },
    ]);
    await supabase
        .from("ipo")
        .update({ shares_sold: ipoData.shares_sold + quantity })
        .eq("company", stock);

    if (error) {
        console.error(error);
        return showPopup("Error recording IPO transaction.", "error");
    }

    showPopup(
        `Successfully bought ${quantity} of ${stock} from IPO at ${formatCurrency(price)}.`,
        "success"
    );
    updateBalanceDisplay();
}

// Helpers
function validateTradeInputs(price, quantity) {
    if (!isValidNumber(price)) {
        showPopup("Please enter a valid price (greater than 0).", "error");
        return false;
    }

    if (!isValidNumber(quantity) || !Number.isInteger(quantity)) {
        showPopup("Please enter a valid quantity (positive integer).", "error");
        return false;
    }

    return true;
}

async function updateBalanceDisplay() {
    const participant = getCurrentParticipant();
    if (participant) {
        const balance = await calculateBalance(participant);
        const balanceElement = document.getElementById("balanceDisplay");
        if (balanceElement) {
            balanceElement.innerText = formatCurrency(balance);
        }
    }
}

function showPopup(message, type = "info") {
    const popup = document.getElementById("popupModal");
    const popupMessage = document.getElementById("popupMessage");
    const popupContent = document.querySelector(".modal-content");

    popupMessage.innerText = message;
    popupContent.className = "modal-content";
    popupContent.classList.add(`modal-${type}`);
    popup.style.display = "block";

    if (type === "success") {
        setTimeout(() => closePopup(), 5000);
    }
}

function closePopup() {
    document.getElementById("popupModal").style.display = "none";
}
