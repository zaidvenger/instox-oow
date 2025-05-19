// login.js

function showError(message) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block";

    setTimeout(() => {
        errorElement.style.display = "none";
    }, 3000);
}

async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        showError("Please enter both username and password.");
        return;
    }

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

    if (error || !data) {
        showError("Invalid username.");
        return;
    }

    if (data.password !== password) {
        showError("Incorrect password.");
        return;
    }

    sessionStorage.setItem("currentUser", username);
    sessionStorage.setItem("currentRole", data.role);
    window.location.href = "index.html"; 
   
}

window.onload = function () {
    document.getElementById("password").addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            login();
        }
    });
};
