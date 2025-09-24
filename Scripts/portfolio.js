// portfolio.js

document.addEventListener("DOMContentLoaded", async () => {
    if (!initPage()) return;

    const role = getRole();
    const dropdownContainer = document.getElementById("portfolio-dropdown-container");

    if (role === "broker" || role === "admin") {
        // Show the "Select the team" label
        document.getElementById("selectTeamText").style.display = "block";

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

        // Insert the dropdown into the new container
        dropdownContainer.appendChild(dropdown);
        
        dropdown.addEventListener("change", () => displayPortfolio(dropdown.value));
        await displayPortfolio(dropdown.value);
    } else {
        await displayPortfolio(getUser());
    }
});

async function displayPortfolio(username) {
    const boughtTable = document.getElementById("boughtTable");
    const soldTable = document.getElementById("soldTable");
    const adjustmentsTableBody = document.querySelector("#adjustmentsTable tbody");
    const cashElement = document.querySelector("#cashInHand"); // Corrected selector
    const netWorthElement = document.getElementById("netWorth");
    const stocksElement = document.getElementById("stocksOwned");

    const role = getRole();

    const cashCard = cashElement ? cashElement.closest(".card") : null;
    const boughtCard = boughtTable ? boughtTable.closest(".card") : null;
    const soldCard = soldTable ? soldTable.closest(".card") : null;
    const stocksCard = stocksElement ? stocksElement.closest(".card") : null;
    const adjustmentsCard = document.getElementById("adjustmentsCard");

    if (boughtTable) while (boughtTable.rows.length > 1) boughtTable.deleteRow(1);
    if (soldTable) while (soldTable.rows.length > 1) soldTable.deleteRow(1);
    if (adjustmentsTableBody) adjustmentsTableBody.innerHTML = "";

    const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("id, initial_balance") // Fetch initial balance
        .eq("username", username)
        .single();

    if (userError || !userRecord) {
        console.error("User not found in database.");
        if (role === "trader") {
            if (cashCard) cashCard.style.display = "none";
            if (boughtCard) boughtCard.style.display = "none";
            if (soldCard) soldCard.style.display = "none";
            if (adjustmentsCard) adjustmentsCard.style.display = "none";
            if (stocksCard) stocksCard.style.display = "";
            if (stocksElement) stocksElement.innerHTML = `<p>User Data Empty.</p>`;
        }
        return;
    }

    const userId = userRecord.id;

    const { data: transactions = [], error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false });

    if (txError) {
        console.error("Error fetching transactions:", txError.message);
        return;
    }

    const bought = transactions.filter((t) => t.type === "buy");
    const sold = transactions.filter((t) => t.type === "sell");
    const adjustments = transactions.filter((t) => t.type === "adjustment");

    let totalSpent = 0;
    let totalEarned = 0;
    let adjustmentsSum = 0;
    const stocksOwned = {};

    for (const tx of bought) {
        const q = parseInt(tx.quantity || 0, 10) || 0;
        const p = parseFloat(tx.price || 0) || 0;
        const total = q * p;
        totalSpent += total;
        stocksOwned[tx.stock] = (stocksOwned[tx.stock] || 0) + q;
        if (role !== "trader" && boughtTable) {
            const row = boughtTable.insertRow();
            row.innerHTML = `
                <td>${tx.stock}</td>
                <td>${q}</td>
                <td>${formatCurrency(p)}</td>
                <td>${formatCurrency(total)}</td>
                <td>${new Date(tx.timestamp).toLocaleDateString()} from ${tx.counterparty || "Market"}${tx.reason ? " — " + tx.reason : ""}</td>
            `;
        }
    }

    for (const tx of sold) {
        const q = parseInt(tx.quantity || 0, 10) || 0;
        const p = parseFloat(tx.price || 0) || 0;
        const total = q * p;
        totalEarned += total;
        stocksOwned[tx.stock] = (stocksOwned[tx.stock] || 0) - q;
        if (role !== "trader" && soldTable) {
            const row = soldTable.insertRow();
            row.innerHTML = `
                <td>${tx.stock}</td>
                <td>${q}</td>
                <td>${formatCurrency(p)}</td>
                <td>${formatCurrency(total)}</td>
                <td>${new Date(tx.timestamp).toLocaleDateString()} to ${tx.counterparty || "Market"}${tx.reason ? " — " + tx.reason : ""}</td>
            `;
        }
    }

    for (const tx of adjustments) {
        const amt = parseFloat(tx.price || 0) || 0;
        adjustmentsSum += amt;
        if (role !== "trader" && adjustmentsTableBody) {
            const row = adjustmentsTableBody.insertRow();
            const type = amt >= 0 ? "Credit" : "Debit";
            const color = amt >= 0 ? "var(--success)" : "var(--destructive)";
            
            row.innerHTML = `
                <td>${type}</td>
                <td style="color: ${color};">${formatCurrency(amt)}</td>
                <td>${tx.reason || tx.counterparty || "Adjustment"}</td>
                <td>${new Date(tx.timestamp).toLocaleDateString()}</td>
            `;
        }
    }

    if (role === "trader") {
        if (cashCard) cashCard.style.display = "none";
        if (boughtCard) boughtCard.style.display = "none";
        if (soldCard) soldCard.style.display = "none";
        if (adjustmentsCard) adjustmentsCard.style.display = "none";
        if (stocksCard) stocksCard.style.display = "";
    } else {
        if (cashCard) cashCard.style.display = "";
        if (boughtCard) boughtCard.style.display = "";
        if (soldCard) soldCard.style.display = "";
        if (stocksCard) stocksCard.style.display = "";
        if (adjustmentsCard) adjustmentsCard.style.display = adjustments.length > 0 ? "" : "none";
    }

    const cashBalance = userRecord.initial_balance + totalEarned - totalSpent + adjustmentsSum;
    if (cashElement && role !== "trader") {
        cashElement.innerText = `Cash in Hand: ${formatCurrency(cashBalance)}`;
    }
    
    // Calculate and display Net Worth
    const { data: stocksData, error: stocksError } = await supabase.from('stocks').select('symbol, price');
    if (stocksError) {
        console.error("Error fetching stock prices:", stocksError.message);
        return;
    }

    let stocksValue = 0;
    if (stocksData) {
        const stockPrices = stocksData.reduce((acc, s) => {
            acc[s.symbol] = s.price;
            return acc;
        }, {});
        for (const stock in stocksOwned) {
            stocksValue += stocksOwned[stock] * (stockPrices[stock] || 0);
        }
    }

    const netWorth = cashBalance + stocksValue;
    if (netWorthElement && role !== "trader") {
        netWorthElement.innerText = `Net Worth: ${formatCurrency(netWorth)}`;
    }

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