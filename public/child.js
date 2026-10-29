console.log("✅ child.js loaded");

let parentId = null;
let childId = null;

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            localStorage.removeItem("parentId");
            localStorage.removeItem("childId");
            localStorage.removeItem("childName");
            window.location.href = "child-login.html";
            return;
        }

        parentId = localStorage.getItem("parentId");
        childId = localStorage.getItem("childId");
        const childName = localStorage.getItem("childName");

        if (user.uid !== parentId) {
            localStorage.removeItem("parentId");
            localStorage.removeItem("childId");
            localStorage.removeItem("childName");
            window.location.href = "index.html";
            return;
        }

        if (!parentId || !childId || !childName) {
            window.location.href = "child-login.html";
            return;
        }

        document.getElementById("child-name").innerText = childName;

        loadChildProfile();         // icon + color
        loadMyChores();             // assigned chores
        loadAvailableChores();      // unassigned chores
        loadArchivedChoresForChild();
        loadChildStats();
        renderColorOptions();
        renderAvatarOptions();
    });
});

function childRef() {
    return db.collection("users").doc(parentId).collection("children").doc(childId);
}

function choresRef() {
    return db.collection("users").doc(parentId).collection("chores");
}

function archiveRef() {
    return db.collection("users").doc(parentId).collection("archived_chores");
}

/* =========================
   Profile (icon + color)
========================= */
async function loadChildProfile() {
    try {
        const doc = await childRef().get();
        if (!doc.exists) return;

        const data = doc.data();

        // Icon
        const iconSpan = document.getElementById("child-icon");
        if (iconSpan) {
            if (data.icon) {
                const img = document.createElement("img");
                img.src = `piggies/${data.icon}`;
                img.alt = "Avatar";
                img.className = "w-8 h-8 rounded-full";
                iconSpan.innerHTML = "";
                iconSpan.appendChild(img);
            } else {
                iconSpan.textContent = "🐷";
            }
        }

        // Optional: use child color as a subtle accent (totally optional)
        // document.body.style.backgroundColor = data.color ? data.color + "22" : "";
    } catch (err) {
        console.error("loadChildProfile error:", err);
    }
}

/* =========================
   My Chores (assigned to me)
========================= */
async function loadMyChores() {
    const choresList = document.getElementById("chores-list");
    const totalEarnedSpan = document.getElementById("total-earned");
    if (!choresList) return;

    choresList.innerHTML = "<p class='text-gray-500'>Loading...</p>";
    if (totalEarnedSpan) totalEarnedSpan.innerText = "0.00";

    try {
        // Show assigned chores in every review state until they are paid.
        const snap = await choresRef()
            .where("assignedToChildId", "==", childId)
            .orderBy("updatedAt", "desc")
            .get();

        choresList.innerHTML = "";

        if (snap.empty) {
            choresList.innerHTML = "<p class='text-gray-500'>No chores assigned to you right now.</p>";
            return;
        }

        let totalCents = 0;

        snap.forEach(doc => {
            const chore = doc.data();

            const title = chore.title || "Untitled";
            const rewardCents = Number(chore.rewardCents || 0);
            const status = chore.status || "ASSIGNED";

            // Parent-approved chores are COMPLETED; submissions stay pending.
            if (status === "COMPLETED") totalCents += rewardCents;

            const dateText = chore.date || "—";

            const div = document.createElement("div");
            div.className = "border rounded-lg p-4 bg-white shadow";

            const statusLabel =
                status === "COMPLETED" ? "✅ Approved — unpaid" :
                    status === "PENDING_APPROVAL" ? "⏳ Waiting for parent approval" :
                    status === "ASSIGNED" ? "🕒 Assigned" :
                        status;

            div.innerHTML = `
        <strong class="text-lg">${title}</strong><br>
        Reward: $${(rewardCents / 100).toFixed(2)}<br>
        Date: ${dateText}<br>
        Status: ${statusLabel}
        ${status === "ASSIGNED" ? `
          <div class="mt-3 flex gap-2">
            <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              onclick="markComplete('${doc.id}')">
              Mark Complete
            </button>
            <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
              onclick="returnChore('${doc.id}')">
              Return
            </button>
          </div>
        ` : ""}
      `;

            choresList.appendChild(div);
        });

        if (totalEarnedSpan) totalEarnedSpan.innerText = (totalCents / 100).toFixed(2);
    } catch (err) {
        console.error("loadMyChores error:", err);
        choresList.innerHTML = `<p class="text-red-500">Failed to load chores: ${err.message}</p>`;
    }
}

async function markComplete(choreId) {
    try {
        await choresRef().doc(choreId).update({
            status: "PENDING_APPROVAL",
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedByChildId: childId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadMyChores();
        await loadChildStats();
    } catch (err) {
        console.error("markComplete error:", err);
        alert("Could not mark complete: " + err.message);
    }
}

/* =========================
   Available Chores (UNASSIGNED)
========================= */
async function loadAvailableChores() {
    const availableList = document.getElementById("available-chores");
    if (!availableList) return;

    availableList.innerHTML = "<p class='text-gray-500'>Loading...</p>";

    try {
        const snap = await choresRef()
            .where("status", "==", "UNASSIGNED")
            .where("assignedToChildId", "==", null)
            .orderBy("updatedAt", "desc")
            .get();

        if (snap.empty) {
            availableList.innerHTML = "<p class='text-gray-500'>No chores available right now. Check back soon!</p>";
            return;
        }

        availableList.innerHTML = "";

        snap.forEach(doc => {
            const chore = doc.data();
            const title = chore.title || "Untitled";
            const rewardCents = Number(chore.rewardCents || 0);
            const dateText = chore.date || "—";

            const div = document.createElement("div");
            div.className = "border rounded-lg p-4 bg-yellow-100 shadow";

            div.innerHTML = `
        <strong class="text-lg">${title}</strong><br>
        Reward: $${(rewardCents / 100).toFixed(2)}<br>
        Date: ${dateText}<br>
        <button class="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
          onclick="claimChore('${doc.id}')">
          Claim This Chore
        </button>
      `;

            availableList.appendChild(div);
        });
    } catch (err) {
        console.error("loadAvailableChores error:", err);
        availableList.innerHTML = `<p class="text-red-500">Failed to load available chores: ${err.message}</p>`;
    }
}

async function claimChore(choreId) {
    try {
        await choresRef().doc(choreId).update({
            status: "ASSIGNED",
            assignedToChildId: childId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Chore claimed!");
        await loadMyChores();
        await loadAvailableChores();
    } catch (err) {
        console.error("claimChore error:", err);
        alert("Could not claim chore: " + err.message);
    }
}

async function returnChore(choreId) {
    try {
        await choresRef().doc(choreId).update({
            status: "UNASSIGNED",
            assignedToChildId: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Chore returned to the available pool.");
        await loadMyChores();
        await loadAvailableChores();
    } catch (err) {
        console.error("returnChore error:", err);
        alert("Could not return chore: " + err.message);
    }
}

/* =========================
   Archived chores (paid or deleted)
========================= */
async function loadArchivedChoresForChild() {
    const container = document.getElementById("archived-chores");
    if (!container) return;

    container.innerHTML = "<p class='text-gray-500'>Loading...</p>";

    try {
        const snap = await archiveRef()
            .where("assignedToChildId", "==", childId)
            .orderBy("archivedAt", "desc")
            .get();

        if (snap.empty) {
            container.innerHTML = "<p class='text-gray-500'>No chore history yet.</p>";
            return;
        }

        container.innerHTML = "";

        snap.forEach(doc => {
            const a = doc.data();
            const title = a.title || "Untitled";
            const rewardCents = Number(a.rewardCents || 0);
            const dateText = a.date || "—";
            const outcome = a.archiveReason === "PAID" ? "Paid" : "Deleted";

            const div = document.createElement("div");
            div.className = "border rounded-lg p-4 bg-white shadow";

            div.innerHTML = `
        <strong class="text-lg">${title}</strong><br>
        Reward: $${(rewardCents / 100).toFixed(2)}<br>
        Date: ${dateText}<br>
        Outcome: ${outcome}
      `;

            container.appendChild(div);
        });
    } catch (err) {
        console.error("loadArchivedChoresForChild error:", err);
        container.innerHTML = `<p class="text-red-500">Failed to load history: ${err.message}</p>`;
    }
}

/* =========================
   Stats panel
========================= */
async function loadChildStats() {
    const completedEl = document.getElementById("stat-total-completed");
    const earnedYearEl = document.getElementById("stat-earned-this-year");

    if (!completedEl || !earnedYearEl) return;

    try {
        const year = new Date().getFullYear();

        // Count archived PAID chores for “earned this year” (more accurate than active chores)
        const snap = await archiveRef()
            .where("assignedToChildId", "==", childId)
            .get();

        let completed = 0;
        let earnedThisYearCents = 0;

        snap.forEach(doc => {
            const a = doc.data();
            completed += 1;

            const archivedAt = a.archivedAt?.toDate?.() || null;
            if (archivedAt && archivedAt.getFullYear() === year && a.archiveReason === "PAID") {
                earnedThisYearCents += Number(a.rewardCents || 0);
            }
        });

        completedEl.innerText = `Chores Completed: ${completed}`;
        earnedYearEl.innerText = `Earned This Year: $${(earnedThisYearCents / 100).toFixed(2)}`;
    } catch (err) {
        console.error("loadChildStats error:", err);
    }
}

/* =========================
   Settings panel
========================= */
function toggleChildSettings() {
    const panel = document.getElementById("child-settings-panel");
    if (panel) panel.classList.toggle("translate-x-full");
}

function logout() {
    localStorage.removeItem("parentId");
    localStorage.removeItem("childId");
    localStorage.removeItem("childName");
    localStorage.removeItem("childColor");
    localStorage.removeItem("childIcon");
    window.location.href = "child-login.html";
}

/* =========================
   Color + Avatar pickers
========================= */
const presetColors = [
    "#FFB6B9", "#FFDAC1", "#E2F0CB", "#B5EAD7",
    "#C7CEEA", "#F5C7B8", "#F2B5D4", "#C3F2B5"
];

function renderColorOptions() {
    const container = document.getElementById("color-options");
    if (!container) return;

    container.innerHTML = "";

    presetColors.forEach(color => {
        const btn = document.createElement("button");
        btn.style.backgroundColor = color;
        btn.className = "w-8 h-8 rounded-full border-2 border-white shadow hover:scale-110 transition";
        btn.onclick = async () => {
            try {
                await childRef().update({ color });
                localStorage.setItem("childColor", color);
            } catch (err) {
                alert("Color update failed: " + err.message);
            }
        };
        container.appendChild(btn);
    });
}

const piggyIcons = [
    "piggy_dollar_leap.png",
    "piggy_dollar_smug.png",
    "piggy_dollar_stand.png",
    "piggy_onecoin_sideview.png",
    "piggy_onecoin_smug.png",
    "piggy_onecoin_walk.png",
    "piggy_twocoins_broken.png",
    "piggy_twocoins_closeup.png",
    "piggy_twocoins_insert.png",
    "piggy_twocoins_walk.png"
];

function renderAvatarOptions() {
    const container = document.getElementById("avatar-options");
    if (!container) return;

    container.innerHTML = "";

    piggyIcons.forEach(iconFile => {
        const img = document.createElement("img");
        img.src = `piggies/${iconFile}`;
        img.alt = iconFile;
        img.className =
            "w-12 h-12 object-contain border border-gray-300 rounded hover:bg-gray-100 p-1 cursor-pointer";

        img.onclick = async () => {
            try {
                await childRef().update({ icon: iconFile });
                localStorage.setItem("childIcon", iconFile);
                await loadChildProfile(); // refresh icon in header
            } catch (err) {
                alert("Avatar update failed: " + err.message);
            }
        };

        container.appendChild(img);
    });
}

