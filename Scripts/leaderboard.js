// leaderboard.js

document.addEventListener("DOMContentLoaded", () => {
    loadTeamLeaderboard();
});

async function loadTeamLeaderboard() {
    const tbody = document.getElementById("teamLeaderboardBody");
    tbody.innerHTML = "";

    const users = await getAllTeams();
    const leaderboard = [];

    for (const user of users) {
        const username = user.username;
        if (user.role !== "trader") continue;

        const balance = await calculateBalance(username);
        const stocks = await getStockHoldings(username);
        const userData = await getUserData(username);

        // Calculate profit: total earned from sells - total spent on buys
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
        });
    }

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
}
