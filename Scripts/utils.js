// utils.js

// Constants
const INITIAL_BALANCE = 100000;

// === SESSION HELPERS ===
function getUser() {
    return sessionStorage.getItem("currentUser");
}

function setUser(username) {
    sessionStorage.setItem("currentUser", username);
}

function removeUser() {
    sessionStorage.removeItem("currentUser");
}

// add helper to get user id
async function getUserId(username) {
    const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();
    if (error || !user) return null;
    return user.id;
}

// Replace getUserData to load all transactions (including adjustments)
async function getUserData(username) {
    const userId = await getUserId(username);
    if (!userId) return { bought: [], sold: [], adjustments: [], transactions: [] };

    const { data: transactions = [], error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false });

    if (error) {
        console.error("Error loading transactions:", error);
        return { bought: [], sold: [], adjustments: [], transactions: [] };
    }

    const bought = transactions.filter((t) => t.type === "buy");
    const sold = transactions.filter((t) => t.type === "sell");
    const adjustments = transactions.filter((t) => t.type === "adjustment");

    return { bought, sold, adjustments, transactions };
}

// Replace calculateBalance to include adjustments (price used for signed adjustment)
async function calculateBalance(username) {
    const data = await getUserData(username);

    const totalSpent = (data.bought || []).reduce((sum, t) => {
        const q = parseInt(t.quantity || 0, 10) || 0;
        const p = parseFloat(t.price || 0) || 0;
        return sum + q * p;
    }, 0);

    const totalEarned = (data.sold || []).reduce((sum, t) => {
        const q = parseInt(t.quantity || 0, 10) || 0;
        const p = parseFloat(t.price || 0) || 0;
        return sum + q * p;
    }, 0);

    // adjustments stored as transactions with type='adjustment' and price = signed amount
    const adjustmentsSum = (data.adjustments || []).reduce((sum, a) => {
        return sum + (parseFloat(a.price || 0) || 0);
    }, 0);

    const balance = INITIAL_BALANCE - totalSpent + totalEarned + adjustmentsSum;
    return parseFloat(balance.toFixed(2));
}

async function canAffordPurchase(username, cost) {
    const balance = await calculateBalance(username);
    return balance >= cost;
}

async function getAvailableStockQuantity(username, stockName) {
    const data = await getUserData(username);
    const boughtQty = data.bought
        .filter((t) => t.stock === stockName)
        .reduce((sum, t) => sum + parseInt(t.quantity), 0);
    const soldQty = data.sold
        .filter((t) => t.stock === stockName)
        .reduce((sum, t) => sum + parseInt(t.quantity), 0);
    return boughtQty - soldQty;
}

// === AUTH + ROLE ===
function logout() {
    removeUser();
    sessionStorage.removeItem("currentRole");
    window.location.href = "login.html";
}

function initPage() {
    const user = getUser();
    if (!user) {
        window.location.href = "login.html";
        return false;
    }

    const el = document.getElementById("userInfo");
    if (el) {
        el.innerText = `Logged in as: ${user}`;
    }

    return true;
}

function isValidNumber(value) {
    return !isNaN(value) && value > 0;
}

function formatCurrency(amount) {
    return `₹${amount.toLocaleString()}`;
}

function confirmAction(msg) {
    return confirm(msg);
}

function getRole() {
    return sessionStorage.getItem("currentRole");
}

// === TEAM REGISTRATION ===
async function registerTeamAccount(username, password) {
    // Save to users table
    const { error: userError } = await supabase
        .from("users")
        .insert([{ username, password, role: "trader" }]);

    if (userError) {
        throw userError;
    }
}

async function getAllTeams() {
    const { data, error } = await supabase
        .from("users")
        .select("username, role")
        .in("role", ["broker", "trader"]);

    if (error) {
        console.error(error);
        return [];
    }

    // Return as an array of user objects
    return data;
}

// === BROKER UTILITIES ===
function setCurrentParticipant(username) {
    sessionStorage.setItem("currentParticipant", username);
}

function getCurrentParticipant() {
    return sessionStorage.getItem("currentParticipant");
}


async function getStockHoldings(username) {
    const data = await getUserData(username);
    const holdings = {};

    for (const t of data.bought) {
        const qty = parseInt(t.quantity);
        holdings[t.stock] = (holdings[t.stock] || 0) + qty;
    }

    for (const t of data.sold) {
        const qty = parseInt(t.quantity);
        holdings[t.stock] = (holdings[t.stock] || 0) - qty;
    }

    for (const stock in holdings) {
        if (holdings[stock] <= 0) delete holdings[stock];
    }

    return holdings;
}

async function calculatePortfolioValue(username) {
    const holdings = await getStockHoldings(username);
    const { data: finalPrices } = await supabase.from("ipo_final_prices").select("*");
    let total = 0;
    for (const [stock, qty] of Object.entries(holdings)) {
        const priceObj = finalPrices.find(fp => fp.company === stock);
        if (priceObj) {
            total += qty * parseFloat(priceObj.final_price);
        }
    }
    total += await calculateBalance(username);
    return total;
}
