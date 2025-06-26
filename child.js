// JavaScript source code
let childId = "";

document.addEventListener("DOMContentLoaded", function () {
    auth.onAuthStateChanged(user => {
        if (!user) {
            localStorage.removeItem("childId");
            localStorage.removeItem("childName");
            window.location.href = "child-login.html";
        }
    });

    childId = localStorage.getItem("childId");
    const childName = localStorage.getItem("childName");

    if (!childId || !childName) {
        window.location.href = "child-login.html";
    }

    document.getElementById("child-name").innerText = childName;

    loadChores();
    loadAvailableChores();
});


function loadChores() {
    const choresList = document.getElementById("chores-list");
    const totalEarnedSpan = document.getElementById("total-earned");    
    let total = 0;
    choresList.innerHTML = "";

    db.collection("config").doc("payday").get().then(configDoc => {
        let paydayDate = new Date(0);
        const configData = configDoc.data();
        if (configData && configData.nextPayday && typeof configData.nextPayday.toDate === "function") {
            paydayDate = configData.nextPayday.toDate();
        } else {
            console.warn("No valid payday set in config.");
        }

    db.collection("users").doc(childId).collection("chores")
        .orderBy("assignedAt", "desc")
        .get()
        .then(snapshot => {
            console.log("Loaded chores:", snapshot.size); // ✅ Add this
            snapshot.forEach(doc => {
                const chore = doc.data();
                console.log("Chore:", chore); // ✅ Add this too

                let assignedAt = new Date(0);
                if (chore.assignedAt && typeof chore.assignedAt.toDate === "function") {
                    assignedAt = chore.assignedAt.toDate();
                }
                if (!chore.assignedAt) {
                   console.warn("Missing 'assignedAt' field in chore:", chore);
                }
                const isAfterPayday = assignedAt > paydayDate;

                const div = document.createElement("div");
                div.className = `border rounded-lg p-4 bg-white shadow ${chore.complete ? 'bg-green-100 line-through' : ''}`;
                if (chore.complete && isAfterPayday) total += chore.reward;

                div.innerHTML = `
                    <strong class="text-lg">${chore.chore}</strong><br>
                    Reward: $${chore.reward}<br>
                    Assigned: ${assignedAt.toDateString()}<br>
                    Status: ${chore.complete ? "✅ Complete" : "❌ Incomplete"}
                    ${!chore.complete ? `
                        <br>
                        <button class="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mr-2" onclick="markComplete('${doc.id}')">Mark Complete</button>
                        <button class="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded" onclick="returnChore('${doc.id}')">Return</button>
                    ` : ""}
                `;
                choresList.appendChild(div);
            });

            totalEarnedSpan.innerText = total.toFixed(2);
        })
        .catch(error => {
            console.error("Error loading chores:", error);
            alert("Failed to load chores: " + error.message);
        });
    });
}


function claimChore(choreId, reward) {
    console.log("Attempting to claim chore:", choreId);

    const sharedRef = db.collection("shared_chores").doc(choreId);

    sharedRef.get().then(doc => {
        if (!doc.exists) {
            console.warn("Chore not found in shared_chores.");
            alert("That chore no longer exists.");
            return;
        }

        const chore = doc.data();
        console.log("Chore found:", chore);

        return db.collection("users").doc(childId).collection("chores").add({
            ...chore,
            complete: false,
            assignedAt: new Date()
        }).then(() => {
            console.log("Chore added to child:", childId);
            return sharedRef.delete();
        }).then(() => {
            console.log("Chore removed from shared_chores.");
            alert("Chore claimed!");
            loadChores();
            loadAvailableChores();
        });
    }).catch(err => {
        console.error("Error claiming chore:", err);
        alert("Something went wrong claiming the chore.");
    });
}

function logout() {
    localStorage.removeItem("childId");
    localStorage.removeItem("childName");
    window.location.href = "child-login.html";
}

function markComplete(choreId) {
    db.collection("users").doc(childId).collection("chores").doc(choreId)
        .update({ complete: true })
        .then(loadChores);
}
function loadAvailableChores() {
    console.log("Checking shared chores...");

    const availableList = document.getElementById("available-chores");
    availableList.innerHTML = "<p class='text-gray-500'>No chores available right now. Check back soon!</p>";

    db.collection("shared_chores").get().then(snapshot => {
        if (!snapshot.empty) {
            availableList.innerHTML = "";
        }

        snapshot.forEach(doc => {

            const chore = doc.data();
            let assignedAt = new Date();
            if (chore.assignedAt && typeof chore.assignedAt.toDate === "function") {
                assignedAt = chore.assignedAt.toDate();
            } else {
                console.warn("Missing or invalid assignedAt in shared chore:", chore);
            }

            console.log("Available shared chore found:", chore.chore);

            const div = document.createElement("div");
            div.className = "border rounded-lg p-4 bg-yellow-100 shadow";

            div.innerHTML = `
        <strong class="text-lg">${chore.chore}</strong><br>
        Reward: $${chore.reward}<br>
        Available Since: ${assignedAt.toDateString()}<br>
        <button class="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded" onclick="claimChore('${doc.id}', ${chore.reward})">
            Claim This Chore
        </button>
        `;

            availableList.appendChild(div);
        });
    });
}

function returnChore(choreId) {
    console.log("Attempting to return chore:", choreId);

    const choreRef = db.collection("users").doc(childId).collection("chores").doc(choreId);

    choreRef.get().then(doc => {
        if (!doc.exists) {
            console.warn("Chore not found in user collection.");
            alert("That chore no longer exists.");
            return;
        }

        const chore = doc.data();
        console.log("Chore to return:", chore);

        return db.collection("shared_chores").add({
            ...chore,
            assignedAt: new Date()
        }).then(() => {
            console.log("Chore returned to shared_chores.");
            return choreRef.delete();
        }).then(() => {
            console.log("Chore removed from child list.");
            alert("Chore returned to shared pool.");
            loadChores();
            loadAvailableChores();
        });
    }).catch(error => {
        console.error("Error returning chore:", error);
        alert("Something went wrong trying to return this chore.");
    });
}



