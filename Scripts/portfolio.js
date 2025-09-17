// portfolio.js

document.addEventListener("DOMContentLoaded", async () => {
    if (!initPage()) return;

    const role = getRole();
    if (role === "broker" || role === "admin") {
        const users = await getAllTeams();
        const traders = users.filter((u) => u.role === "trader"); // Only traders
        const dropdown = document.createElement("select");
        dropdown.id = "portfolioUserSelect";
        traders.forEach((u) => {
            const opt = document.createElement("option");
            opt.value = u.username;
            opt.text = u.username;
            dropdown.appendChild(opt);
        });
        document
            .querySelector(".container")
            .insertBefore(dropdown, document.querySelector(".card"));
        dropdown.addEventListener("change", () => displayPortfolio(dropdown.value));
        await displayPortfolio(dropdown.value);
    } else {
        await displayPortfolio(getUser());
    }
});

async function displayPortfolio(username) {
    const boughtTable = document.getElementById("boughtTable");
    const soldTable = document.getElementById("soldTable");
    const cashElement = document.querySelector(".card-content h2");
    const stocksElement = document.getElementById("stocksOwned");

    const role = getRole();

    // Find the card containers so we can hide/show whole sections
    const cashCard = cashElement ? cashElement.closest(".card") : null;
    const boughtCard = boughtTable ? boughtTable.closest(".card") : null;
    const soldCard = soldTable ? soldTable.closest(".card") : null;
    const stocksCard = stocksElement ? stocksElement.closest(".card") : null;

    // Clear existing table rows except headers (safe checks)
    if (boughtTable) {
        while (boughtTable.rows.length > 1) boughtTable.deleteRow(1);
    }
    if (soldTable) {
        while (soldTable.rows.length > 1) soldTable.deleteRow(1);
    }

    // Fetch user ID
    const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();

    if (userError || !userRecord) {
        console.error("User not found in database.");
        // If trader, show only stocks card with message
        if (role === "trader") {
            if (cashCard) cashCard.style.display = "none";
            if (boughtCard) boughtCard.style.display = "none";
            if (soldCard) soldCard.style.display = "none";
            if (stocksCard) stocksCard.style.display = "";
            if (stocksElement) stocksElement.innerHTML = `<p>User not found.</p>`;
        }
        return;
    }

    const userId = userRecord.id;

    // Fetch transactions
    const { data: transactions = [], error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false });

    if (txError) {
        console.error("Error fetching transactions:", txError.message);
        return;
    }

    // Categorize transactions
    const bought = transactions.filter((t) => t.type === "buy");
    const sold = transactions.filter((t) => t.type === "sell");

    let totalSpent = 0;
    let totalEarned = 0;
    const stocksOwned = {};

    // Process buys
    for (const tx of bought) {
        const { stock, quantity, price, timestamp, counterparty } = tx;
        const q = parseInt(quantity, 10) || 0;
        const p = parseFloat(price) || 0;
        const total = q * p;
        totalSpent += total;

        stocksOwned[stock] = (stocksOwned[stock] || 0) + q;

        // Only render buy rows for brokers/admins
        if (role !== "trader" && boughtTable) {
            const row = boughtTable.insertRow();
            row.innerHTML = `
                <td>${stock}</td>
                <td>${q}</td>
                <td>${formatCurrency(p)}</td>
                <td>${formatCurrency(total)}</td>
                <td>${new Date(timestamp).toLocaleDateString()} from ${counterparty || "Market"}</td>
            `;
        }
    }

    // Process sells
    for (const tx of sold) {
        const { stock, quantity, price, timestamp, counterparty } = tx;
        const q = parseInt(quantity, 10) || 0;
        const p = parseFloat(price) || 0;
        const total = q * p;
        totalEarned += total;

        stocksOwned[stock] = (stocksOwned[stock] || 0) - q;

        // Only render sell rows for brokers/admins
        if (role !== "trader" && soldTable) {
            const row = soldTable.insertRow();
            row.innerHTML = `
                <td>${stock}</td>
                <td>${q}</td>
                <td>${formatCurrency(p)}</td>
                <td>${formatCurrency(total)}</td>
                <td>${new Date(timestamp).toLocaleDateString()} to ${counterparty || "Market"}</td>
            `;
        }
    }

    // Show/hide sections based on role
    if (role === "trader") {
        if (cashCard) cashCard.style.display = "none";
        if (boughtCard) boughtCard.style.display = "none";
        if (soldCard) soldCard.style.display = "none";
        if (stocksCard) stocksCard.style.display = "";
    } else {
        if (cashCard) cashCard.style.display = "";
        if (boughtCard) boughtCard.style.display = "";
        if (soldCard) soldCard.style.display = "";
        if (stocksCard) stocksCard.style.display = "";
    }

    // Calculate cash in hand
    const balance = INITIAL_BALANCE + totalEarned - totalSpent;
    if (cashElement && role !== "trader") {
        cashElement.innerText = `Cash in Hand: ${formatCurrency(balance)}`;
    }

    // Display owned stocks
    const ownedList = Object.entries(stocksOwned)
        .filter(([_, qty]) => qty > 0)
        .map(([stock, qty]) => `<li><span class="stock-name">${stock}</span>: <span class="stock-quantity">${qty}</span></li>`);

    if (stocksElement) {
        if (ownedList.length > 0) {
            stocksElement.innerHTML = `<ul class='stocks-list'>${ownedList.join("")}</ul>`;
        } else {
            stocksElement.innerHTML = `<p>You don't own any stocks yet.</p>`;
        }
    }
}
