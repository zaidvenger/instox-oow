// adjustments.js

document.addEventListener("DOMContentLoaded", async () => {
  if (!initPage()) return;

  const role = getRole();
  if (role !== "broker" && role !== "admin") {
    alert("Access denied. Only brokers and admins can access this page.");
    window.location.href = "index.html";
    return;
  }

  const teamInput = document.getElementById("teamInput");
  const teamList = document.getElementById("teamList");
  const amountInput = document.getElementById("amountInput");
  const reasonSelect = document.getElementById("reasonSelect");
  const addButton = document.getElementById("addButton");
  const subtractButton = document.getElementById("subtractButton");
  const status = document.getElementById("statusMessage");

  // populate datalist suggestions using teams
  const teams = await getAllTeams();
  teamInput.innerHTML = "<option value=''>Select a team</option>"; // Clear previous options and add placeholder
  teams.forEach(t => {
    if (t.role === 'trader') { // Optional: only show trader teams
      const opt = document.createElement("option");
      opt.value = t.username;
      opt.textContent = t.username;
      teamInput.appendChild(opt);
    }
  });

  function showStatus(msg, kind = "info") {
    status.style.display = "block";
    status.textContent = msg;
    status.className = kind === "error" ? "error-message" : "success-message";
    setTimeout(() => { status.style.display = "none"; }, 4000);
  }

  async function applyAdjustment(isAdd) {
    const username = (teamInput.value || "").trim();
    const rawAmount = parseFloat(amountInput.value);
    const reason = reasonSelect.value;

    if (!username) return showStatus("Please enter a team username.", "error");
    if (!isFinite(rawAmount) || rawAmount <= 0) return showStatus("Enter a positive amount.", "error");
    if (!reason) return showStatus("Please select a reason.", "error");

    const userId = await getUserId(username);
    if (!userId) return showStatus("Team not found.", "error");

    const signedAmount = isAdd ? rawAmount : -rawAmount;

    const payload = {
      user_id: userId,
      stock: null,
      price: signedAmount,    // signed amount for adjustments
      quantity: 0,
      type: "adjustment",
      counterparty: reason,
      reason: reason,
      timestamp: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from("transactions").insert([payload]);
    if (insertErr) {
      console.error("Adjustment insert failed:", insertErr);
      return showStatus("Failed to record adjustment.", "error");
    }

    showStatus(`Successfully ${isAdd ? "added" : "subtracted"} ${rawAmount} for ${username}.`, "success");
    amountInput.value = "";
    reasonSelect.value = "";

    try {
      const bal = await calculateBalance(username);
      showStatus(`New balance for ${username}: ${formatCurrency(bal)}`, "success");
    } catch (e) { /* ignore */ }
  }

  addButton.addEventListener("click", () => applyAdjustment(true));
  subtractButton.addEventListener("click", () => applyAdjustment(false));
});