// leaderboard.js

document.addEventListener("DOMContentLoaded", () => {
    loadTeamLeaderboard();
});

let leaderboard = [];
let currentSort = { key: "totalValue", dir: "desc" };

function renderLeaderboardTable() {
    const tbody = document.getElementById("teamLeaderboardBody");
    tbody.innerHTML = "";
    leaderboard.forEach((entry, idx) => {
        const stocks =
            Object.entries(entry.totalStocks)
                .map(([stock, qty]) => `${stock}: ${qty}`)
                .join("<br>") || "-";
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${entry.team}</td>
            <td>${formatCurrency(entry.totalValue)}</td>
            <td>${formatCurrency(entry.profit)}</td>
            <td>${stocks}</td>
            <td>${formatCurrency(entry.portfolioValue)}</td>
        `;
        tbody.appendChild(row);
    });
}

function sortLeaderboard(key) {
    if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
        currentSort.key = key;
        currentSort.dir = "desc";
    }
    leaderboard.sort((a, b) => {
        let aVal = a[key], bVal = b[key];
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();
        if (aVal < bVal) return currentSort.dir === "asc" ? -1 : 1;
        if (aVal > bVal) return currentSort.dir === "asc" ? 1 : -1;
        return 0;
    });
    updateSortIcons();
    renderLeaderboardTable();
}

function updateSortIcons() {
    const icons = {
        totalValue: document.getElementById("iconTotalValue"),
        profit: document.getElementById("iconProfit"),
        stockQuantities: document.getElementById("iconStockQuantities"),
        portfolioValue: document.getElementById("iconPortfolioValue"),
    };
    Object.keys(icons).forEach(key => {
        icons[key].textContent = "↕";
    });
    let icon = icons[currentSort.key];
    if (icon) icon.textContent = currentSort.dir === "asc" ? "▲" : "▼";
}

async function loadTeamLeaderboard() {
    const tbody = document.getElementById("teamLeaderboardBody");
    const loadingDiv = document.getElementById("leaderboardLoading");
    tbody.innerHTML = "";
    loadingDiv.style.display = "block";

    const users = await getAllTeams();
    const traderUsers = users.filter(
        user => user.role === "trader" && user.username !== "Ins_Inv"
    );

    leaderboard = [];

    await Promise.all(traderUsers.map(async (user) => {
        const username = user.username;
        const [balance, stocks, userData, portfolioValue] = await Promise.all([
            calculateBalance(username),
            getStockHoldings(username),
            getUserData(username),
            calculatePortfolioValue(username)
        ]);

        const totalSpent = userData.bought.reduce(
            (sum, t) => sum + parseFloat(t.price) * parseInt(t.quantity), 0
        );
        const totalEarned = userData.sold.reduce(
            (sum, t) => sum + parseFloat(t.price) * parseInt(t.quantity), 0
        );
        const profit = totalEarned - totalSpent;

        leaderboard.push({
            team: username,
            totalValue: balance,
            profit,
            totalStocks: stocks,
            portfolioValue,
            stockQuantities: Object.values(stocks).reduce((a, b) => a + b, 0)
        });
    }));

    // Default sort
    sortLeaderboard(currentSort.key);

    loadingDiv.style.display = "none";
}

// Add event listeners for sorting after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("thTotalValue").onclick = () => sortLeaderboard("totalValue");
    document.getElementById("thProfit").onclick = () => sortLeaderboard("profit");
    document.getElementById("thStockQuantities").onclick = () => sortLeaderboard("stockQuantities");
    document.getElementById("thPortfolioValue").onclick = () => sortLeaderboard("portfolioValue");
});
