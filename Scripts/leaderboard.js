// leaderboard.js

document.addEventListener("DOMContentLoaded", () => {
    loadTeamLeaderboard();
});

async function loadTeamLeaderboard() {
    const tbody = document.getElementById("teamLeaderboardBody");
    const loadingDiv = document.getElementById("leaderboardLoading");
    tbody.innerHTML = "";
    loadingDiv.style.display = "block";

    const users = await getAllTeams();
    const traderUsers = users.filter(user => user.role === "trader");

    // Fetch all data in parallel
    const leaderboardPromises = traderUsers.map(async (user) => {
        const username = user.username;
        // Fetch all data for this user in parallel
        const [balance, stocks, userData] = await Promise.all([
            calculateBalance(username),
            getStockHoldings(username),
            getUserData(username)
        ]);

        const totalSpent = userData.bought.reduce(
            (sum, t) => sum + parseFloat(t.price) * parseInt(t.quantity), 0
        );
        const totalEarned = userData.sold.reduce(
            (sum, t) => sum + parseFloat(t.price) * parseInt(t.quantity), 0
        );
        const profit = totalEarned - totalSpent;

        return {
            team: username,
            totalValue: balance,
            profit,
            totalStocks: stocks,
        };
    });

    // Wait for all leaderboard entries to be ready
    const leaderboard = await Promise.all(leaderboardPromises);

    // Sort and render
    leaderboard.sort((a, b) => b.totalValue - a.totalValue);

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
        `;
        tbody.appendChild(row);
    });

    loadingDiv.style.display = "none";
}
