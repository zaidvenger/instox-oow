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
        const userId = user.username;
        const balance = await calculateBalance(userId);
        const userData = await getUserData(userId);
        const hasActivity = userData.bought.length > 0 || userData.sold.length > 0;

        const row = table.insertRow();
        row.innerHTML = `
            <td>${userId}</td>
            <td>${user.role}</td>
            <td>${formatCurrency(balance)}</td>
            <td>${
                hasActivity
                    ? userData.bought.length + userData.sold.length + " transactions"
                    : "No activity"
            }</td>
            <td>
                <button class="secondary" onclick="resetUser('${userId}')">Reset</button>
                <button class="secondary" onclick="viewUserDetails('${userId}')">View Details</button>
            </td>
        `;
    }
}

// Reset a single user
async function resetUser(userId) {
    if (
        !confirmAction(
            `Are you sure you want to reset ${userId}? This will clear all their transactions.`
        )
    ) {
        return;
    }

    await resetTransactions(userId);

    const message = document.getElementById("statusMessage");
    message.textContent = `Reset ${userId} successfully.`;
    message.className = "success-message";
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 3000);

    await loadAdminPanel();
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

    // Fetch all traders from the database
    const users = await getAllTeams();
    const traders = users.filter((user) => user.role === "trader");

    // Reset transactions for each trader
    for (const trader of traders) {
        await resetTransactions(trader.username);
    }

    const message = document.getElementById("statusMessage");
    message.textContent = "All users have been reset successfully.";
    message.className = "success-message";
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 3000);

    await loadAdminPanel();
}

// Helper: Reset a team's transactions
async function resetTransactions(username) {
    const { data: user, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();

    if (error || !user) {
        console.error(`Failed to reset transactions for ${username}:`, error);
        return;
    }

    await supabase.from("transactions").delete().eq("user_id", user.id);
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
            "Are you sure you want to reset EVERYTHING? This will clear all transactions and reset IPO shares to 0. This action cannot be undone."
        )
    ) {
        return;
    }

    try {
        // Delete all transactions (match all rows)
        const { error: transactionError } = await supabase
            .from("transactions")
            .delete()
            .not('id', 'is', null); // This matches all rows

        if (transactionError) throw transactionError;

        // Reset all IPO shares_sold to 0 (match all rows)
        const { error: ipoError } = await supabase
            .from("ipo")
            .update({ shares_sold: 0 })
            .not('id', 'is', null); // This matches all rows

        if (ipoError) throw ipoError;

        const message = document.getElementById("statusMessage");
        message.textContent = "Successfully reset everything!";
        message.className = "success-message";
        message.style.display = "block";

        setTimeout(() => {
            message.style.display = "none";
        }, 3000);

        await loadAdminPanel();
    } catch (error) {
        console.error("Failed to reset everything:", error);
        const message = document.getElementById("statusMessage");
        message.textContent = "Failed to reset everything. Check console for details.";
        message.className = "error-message";
        message.style.display = "block";
    }
}
