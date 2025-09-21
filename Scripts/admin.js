// admin.js

document.addEventListener("DOMContentLoaded", async () => {
    if (!initPage()) return;

    const role = getRole();
    if (role !== "admin") {
        alert("Access Denied. Admin privileges required.");
        window.location.href = "index.html";
        return;
    }

    await loadAdminPanel();
});

// Load admin panel data
async function loadAdminPanel() {
    const table = document.getElementById("adminTable");

    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    // Fetch all users from Supabase
    const users = await getAllTeams();

    // Filter to only show traders
    const traders = users.filter((user) => user.role === "trader");

    for (const user of traders) {
        const username = user.username;
        const balance = await calculateBalance(username);
        const userData = await getUserData(username);
        const hasActivity = (userData.bought?.length || 0) + (userData.sold?.length || 0) > 0;

        const row = table.insertRow();
        row.innerHTML = `
            <td>${username}</td>
            <td>${user.role}</td>
            <td>${formatCurrency(balance)}</td>
            <td>${hasActivity ? (userData.bought.length + userData.sold.length) + " transactions" : "No activity"}</td>
            <td>
                <button class="secondary" onclick="resetUser('${username}')">Reset</button>
                <button class="secondary" onclick="viewUserDetails('${username}')">View Details</button>
            </td>
        `;
    }
}

// Reset a single user
async function resetUser(username) {
    if (
        !confirmAction(
            `Are you sure you want to reset ${username}? This will clear all their transactions.`
        )
    ) {
        return;
    }

    const result = await resetTransactions(username);

    const messageEl = document.getElementById("statusMessage");
    if (!result.ok) {
        console.error("Reset user failed:", result.error);
        if (messageEl) {
            messageEl.textContent = `Failed to reset ${username}: ${result.error?.message || result.error}`;
            messageEl.className = "error-message";
            messageEl.style.display = "block";
        }
    } else {
        if (messageEl) {
            messageEl.textContent = `Reset ${username} successfully.`;
            messageEl.className = "success-message";
            messageEl.style.display = "block";
        }
    }

    setTimeout(() => {
        if (messageEl) messageEl.style.display = "none";
    }, 3000);

    await loadAdminPanel();
    if (typeof loadTeamLeaderboard === "function") await loadTeamLeaderboard();
}

// Helper: Reset a team's transactions
async function resetTransactions(username) {
    // Find user id
    const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();

    if (userErr || !user) {
        console.error(`Failed to find user ${username}:`, userErr);
        return { ok: false, error: userErr || `User ${username} not found` };
    }

    // delete transactions for this user
    const { data, error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", user.id);

    if (error) {
        console.error(`Failed to delete transactions for ${username}:`, error);
        return { ok: false, error };
    }

    return { ok: true, deletedCount: Array.isArray(data) ? data.length : (data ? 1 : 0) };
}

// Reset all users
async function resetAllUsers() {
    if (
        !confirmAction(
            "Are you sure you want to reset ALL users? This will clear all transactions for all users."
        )
    ) {
        return;
    }

    const users = await getAllTeams();
    const traders = users.filter((user) => user.role === "trader");

    let failed = [];
    for (const trader of traders) {
        const res = await resetTransactions(trader.username);
        if (!res.ok) failed.push({ username: trader.username, error: res.error });
    }

    const message = document.getElementById("statusMessage");
    if (failed.length === 0) {
        message.textContent = "All users have been reset successfully.";
        message.className = "success-message";
    } else {
        console.error("Failed resets:", failed);
        message.textContent = `Reset completed with ${failed.length} failures. See console.`;
        message.className = "error-message";
    }
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 3000);

    await loadAdminPanel();
    if (typeof loadTeamLeaderboard === "function") await loadTeamLeaderboard();
}

// View user details
async function viewUserDetails(userId) {
    const userData = await getUserData(userId);
    const balance = await calculateBalance(userId);

    let totalSpent = 0;
    let totalEarned = 0;

    // Calculate total spent and earned
    for (const transaction of userData.bought) {

        totalSpent += parseFloat(transaction.price) * parseInt(transaction.quantity);
    }
    for (const transaction of userData.sold) {
        totalEarned += parseFloat(transaction.price) * parseInt(transaction.quantity);
    }

    const profit = totalEarned - totalSpent;
    const content = `
        <h3>User Details: ${userId}</h3>
        <p>Current Balance: ${formatCurrency(balance)}</p>
        <h4>Transaction Summary:</h4>
        <p>Purchases: ${userData.bought.length}</p>
        <p>Sales: ${userData.sold.length}</p>
        <p>Profit: ${formatCurrency(profit)}</p>
    `;

    const modal = document.getElementById("detailsModal");
    const modalContent = document.getElementById("detailsContent");
    modalContent.innerHTML = content;
    modal.style.display = "block";
}

// Close modal
function closeModal() {
    document.getElementById("detailsModal").style.display = "none";
}

// --- Team Registration Logic ---
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("teamRegistrationForm");
    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const teamNumber = document.getElementById("teamNumber").value;
            const p1 = document.getElementById("participant1").value.trim();
            if (!teamNumber || !p1) return;

            try {
                await registerTeamAccount(teamNumber, p1, "default-password");
                document.getElementById(
                    "teamRegistrationStatus"
                ).innerText = `Registered Team ${teamNumber}: Trader - ${p1}`;
                form.reset();
            } catch (err) {
                document.getElementById("teamRegistrationStatus").innerText = err.message;
            }
        });
    }
});

async function resetEverything() {
    if (
        !confirmAction(
            "Are you sure you want to reset EVERYTHING? This will clear all transactions and reset IPO shares and final prices to 0. This action cannot be undone."
        )
    ) {
        return;
    }

    try {
        // Delete all transactions
        const { data: delData, error: transactionError } = await supabase
            .from("transactions")
            .delete()
            .not("id", "is", null);

        if (transactionError) throw transactionError;

        // Update IPO shares_sold to 0
        const { error: ipoError } = await supabase
            .from("ipo")
            .update({ shares_sold: 0 })
            .not("company", "is", null);

        if (ipoError) throw ipoError;

        // Reset final IPO prices to 0
        const { error: finalPriceError } = await supabase
            .from("ipo_final_prices")
            .update({ final_price: 0 })
            .not("company", "is", null);

        if (finalPriceError) throw finalPriceError;

        const message = document.getElementById("statusMessage");
        message.textContent = "Successfully reset everything!";
        message.className = "success-message";
        message.style.display = "block";

        setTimeout(() => {
            message.style.display = "none";
        }, 3000);

        await loadAdminPanel();
        if (typeof loadTeamLeaderboard === "function") await loadTeamLeaderboard();
    } catch (error) {
        console.error("Failed to reset everything:", error);
        const message = document.getElementById("statusMessage");
        message.textContent = "Failed to reset everything. Check console for details.";
        message.className = "error-message";
        message.style.display = "block";
    }
}

// Load the final prices form
async function loadFinalPricesForm() {
    const { data: companies } = await supabase.from("ipo").select("company");
    const { data: finalPrices } = await supabase.from("ipo_final_prices").select("*");
    const form = document.getElementById("finalPricesForm");
    form.innerHTML = "";

    companies.forEach(company => {
        const priceObj = finalPrices?.find(fp => fp.company === company.company);
        form.innerHTML += `
            <div>
                <label>${company.company}:</label>
                <input type="number" min="0" step="0.01" id="finalPrice_${company.company}" value="${priceObj ? priceObj.final_price : ''}">
            </div>
        `;
    });
}

// Save the final prices to the DB
async function saveFinalPrices() {
    const { data: companies } = await supabase.from("ipo").select("company");
    for (const company of companies) {
        const price = parseFloat(document.getElementById(`finalPrice_${company.company}`).value);
        if (!isNaN(price)) {
            await supabase.from("ipo_final_prices").upsert([
                { company: company.company, final_price: price }
            ]);
        }
    }
    alert("Final prices saved!");
}

async function saveAndCalculateValues() {
    await saveFinalPrices();
    if (typeof calculatePortfolioValues === "function") {
        await calculatePortfolioValues();
    }
}

// Call this on page load
document.addEventListener("DOMContentLoaded", loadFinalPricesForm);
