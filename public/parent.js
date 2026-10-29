console.log("✅ parent.js script loaded");
let parentId = null;

auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    parentId = user.uid;

    loadActiveChores();
    loadChoreHistory();

    // Parent info
    db.collection("users").doc(parentId).get().then(doc => {
        if (doc.exists) {
            document.getElementById("parent-name").innerText = `Hello, ${doc.data().name}`;
        }
    });

    // Load children list (parent-owned)
    db.collection("users")
        .doc(parentId)
        .collection("children")
        .get()
        .then(snapshot => {
            const select = document.getElementById("child-select");
            const historySelect = document.getElementById("history-child-select");

            // Clear existing options (keep the first default option if you have one)
            if (select) select.innerHTML = `<option value="">-- No One (make public)</option>`;
            if (historySelect) historySelect.innerHTML = `<option value="">-- Select a child --</option>`;

            snapshot.forEach(childDoc => {
                const child = childDoc.data();

                // Assign dropdown
                if (select) {
                    const opt = document.createElement("option");
                    opt.value = childDoc.id;
                    opt.text = child.name;
                    select.appendChild(opt);
                }

                // Archived filter dropdown
                if (historySelect) {
                    const opt2 = document.createElement("option");
                    opt2.value = childDoc.id;
                    opt2.text = child.name;
                    historySelect.appendChild(opt2);
                }
            });

            if (historySelect) {
                historySelect.addEventListener("change", () => {
                    const childId = historySelect.value;
                    if (childId) loadArchivedChores(childId);
                    else document.getElementById("archived-history-table").innerHTML =
                        "<p class='text-gray-500'>Select a child to view paid chores.</p>";
                });
            }
        });

    //generateRecurringChores();
});

function goToChildLogin() {
    window.location.href = "child-login.html";
}
function assignChore() {
    if (!parentId) {
        alert("Parent not loaded yet. Please try again.");
        return;
    }
    const childId = document.getElementById("child-select").value;

    const title = document.getElementById("chore").value;
    const reward = parseFloat(document.getElementById("reward").value);

    if (!title || isNaN(reward)) {
        alert("Please enter a valid chore and reward.");
        return;
    }

    db.collection("users")
        .doc(parentId)
        .collection("chores")
        .add({
            title,
            type: "DAILY",
            rewardCents: Math.round(reward * 100),
            date: new Date().toISOString().split("T")[0],

            status: childId ? "ASSIGNED" : "UNASSIGNED",
            assignedToChildId: childId || null,
            assignedByParentId: parentId,

            completedAt: null,
            completedByChildId: null,

            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => alert("Chore assigned!"))
        .catch(err => alert(err.message));
    loadActiveChores();

}
async function deleteChore(choreId) {
    if (!parentId) {
        alert("Parent not loaded yet.");
        return;
    }

    const ok = confirm("Delete this chore? (It will be archived and removed from active chores.)");
    if (!ok) return;

    const reason = prompt("Optional: Why are you deleting this chore?", "") || null;

    try {
        const choreDocRef = db.collection("users").doc(parentId).collection("chores").doc(choreId);
        const choreSnap = await choreDocRef.get();

        if (!choreSnap.exists) {
            alert("Chore not found (maybe already removed).");
            return;
        }

        const chore = choreSnap.data();

        // Safety: don’t let parents delete completed chores if you don’t want that.
        // If you DO want to allow it, remove this block.
        if (chore.status === "COMPLETED") {
            alert("This chore is already completed. Use Mark as Paid (or archive) instead.");
            return;
        }

        const archiveDocRef = db.collection("users").doc(parentId).collection("archived_chores").doc();

        const batch = db.batch();

        batch.set(archiveDocRef, {
            sourceChoreId: choreId,

            // Core chore data (keep whatever you care about)
            title: chore.title || "Untitled",
            type: chore.type || null,
            rewardCents: Number(chore.rewardCents || 0),
            date: chore.date || null,

            statusAtArchive: chore.status || null,

            assignedToChildId: chore.assignedToChildId || null,
            assignedByParentId: chore.assignedByParentId || parentId,
            completedAt: chore.completedAt || null,
            completedByChildId: chore.completedByChildId || null,

            // Archive metadata
            archiveReason: "DELETED",
            archivedAt: firebase.firestore.FieldValue.serverTimestamp(),

            // Delete metadata
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedByParentId: parentId,
            deleteReason: reason,

            // Paid fields (explicitly null)
            paidAt: null,
            paidByParentId: null
        });

        batch.delete(choreDocRef);

        await batch.commit();

        alert("Chore deleted and archived.");

        // Refresh whatever lists you show on parent.html

        if (typeof loadActiveChores === "function") loadActiveChores();
        if (typeof loadChoreHistory === "function") loadChoreHistory();
        if (typeof loadArchivedChores === "function") {
            const dropdown = document.getElementById("history-child-select");
            if (dropdown && dropdown.value) loadArchivedChores(dropdown.value);
        }
    } catch (err) {
        console.error("deleteChore error:", err);
        alert("Delete failed: " + err.message);
    }
}
function savePayday() {
    const manualDate = document.getElementById("payday-date").value;
    const recurringDay = document.getElementById("recurring-day").value;

    if (manualDate && recurringDay) {
        alert("Please pick either a manual date OR a recurring day, not both.");
        return;
    }

    if (!manualDate && !recurringDay) {
        alert("Please select a payday option.");
        return;
    }

    let paydayData = {};

    if (manualDate) {
        paydayData = {
            paydayType: "manual",
            nextPayday: firebase.firestore.Timestamp.fromDate(new Date(manualDate))

        };
    } else if (recurringDay) {
        paydayData = {
            paydayType: "recurring",
            dayOfWeek: recurringDay
        };
    }

    db.collection("users").doc(parentId).collection("settings").doc("payday")
        .set(paydayData)
        .then(() => {
            alert("Payday settings saved!");
        })
        .catch(err => {
            alert("Error saving payday: " + err.message);
        });
}

function updateAccount() {
  const newName = document.getElementById("parent-new-name").value;
  const newEmail = document.getElementById("parent-new-email").value;
  const newPassword = document.getElementById("parent-new-password").value;

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  if (newName) {
    db.collection("users").doc(user.uid).update({ name: newName });
  }
  if (newEmail) {
    user.updateEmail(newEmail).catch(err => alert("Email update failed: " + err.message));
  }
  if (newPassword) {
    user.updatePassword(newPassword).catch(err => alert("Password update failed: " + err.message));
  }

  alert("Account updated!");
}
async function loadActiveChores() {
    const container = document.getElementById("active-chores");
    if (!container) return;

    if (!parentId) {
        container.innerHTML = "<p class='text-red-500'>Parent not loaded yet.</p>";
        return;
    }

    container.innerHTML = "<p class='text-gray-500'>Loading...</p>";

    try {
        const choresRef = db.collection("users").doc(parentId).collection("chores");

        const childrenSnap = await db.collection("users").doc(parentId).collection("children").get();
        const childNames = {};
        childrenSnap.forEach(childDoc => {
            childNames[childDoc.id] = childDoc.data().name || "Child";
        });

        // Include submitted chores so the parent can review them here.
        const snap = await choresRef
            .where("status", "in", ["UNASSIGNED", "ASSIGNED", "PENDING_APPROVAL"])
            .orderBy("updatedAt", "desc")
            .get();

        if (snap.empty) {
            container.innerHTML = "<p class='text-gray-500'>No active chores.</p>";
            return;
        }

        container.innerHTML = "";

        snap.forEach(doc => {
            const chore = doc.data();
            const isPending = chore.status === "PENDING_APPROVAL";
            const assignedLabel = chore.assignedToChildId
                ? `Assigned to ${childNames[chore.assignedToChildId] || "child"}`
                : "Available to claim";
            const dollars = (Number(chore.rewardCents || 0) / 100).toFixed(2);

            const card = document.createElement("div");
            card.className = "border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3";

            const details = document.createElement("div");
            details.className = "flex-1 min-w-[12rem]";
            const title = document.createElement("div");
            title.className = "font-semibold";
            title.textContent = chore.title || "Untitled";
            const meta = document.createElement("div");
            meta.className = "text-sm text-gray-600";
            meta.textContent = `$${dollars} • ${assignedLabel} • ${chore.date || ""}`;
            details.append(title, meta);
            card.appendChild(details);

            if (isPending) {
                const label = document.createElement("div");
                label.className = "w-full text-amber-700 font-medium";
                label.textContent = `Needs approval from ${childNames[chore.assignedToChildId] || "a child"}`;
                card.appendChild(label);

                const approve = document.createElement("button");
                approve.className = "bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded";
                approve.textContent = "Approve";
                approve.addEventListener("click", () => reviewChore(doc.id, true));
                card.appendChild(approve);

                const returnButton = document.createElement("button");
                returnButton.className = "bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded";
                returnButton.textContent = "Needs more work";
                returnButton.addEventListener("click", () => reviewChore(doc.id, false));
                card.appendChild(returnButton);
            }

            const deleteButton = document.createElement("button");
            deleteButton.className = "bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded";
            deleteButton.textContent = "🗑 Delete";
            deleteButton.addEventListener("click", () => deleteChore(doc.id));
            card.appendChild(deleteButton);

            container.appendChild(card);
        });
    } catch (err) {
        console.error("loadActiveChores error:", err);
        container.innerHTML = `<p class='text-red-500'>Error loading chores: ${err.message}</p>`;
    }
}

async function reviewChore(choreId, approved) {
    if (!parentId) return;

    const choreRef = db.collection("users").doc(parentId).collection("chores").doc(choreId);
    try {
        await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(choreRef);
            if (!snapshot.exists || snapshot.data().status !== "PENDING_APPROVAL") {
                throw new Error("This chore is no longer waiting for approval. Refresh and try again.");
            }

            const update = {
                status: approved ? "COMPLETED" : "ASSIGNED",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (approved) {
                update.approvedAt = firebase.firestore.FieldValue.serverTimestamp();
                update.approvedByParentId = parentId;
            } else {
                update.completedAt = firebase.firestore.FieldValue.delete();
                update.completedByChildId = firebase.firestore.FieldValue.delete();
                update.approvedAt = firebase.firestore.FieldValue.delete();
                update.approvedByParentId = firebase.firestore.FieldValue.delete();
            }

            transaction.update(choreRef, update);
        });

        await Promise.all([loadActiveChores(), loadChoreHistory()]);
    } catch (err) {
        console.error("reviewChore error:", err);
        alert(err.message || "Could not update this chore.");
    }
}

function loadChoreHistory() {
    const container = document.getElementById("history-container");
    if (!container) return;

    if (!parentId) {
        container.innerHTML = "<p class='text-red-500'>Parent not loaded yet.</p>";
        return;
    }

    container.innerHTML = "<p>Loading...</p>";

    const childrenRef = db.collection("users").doc(parentId).collection("children");
    const choresRef = db.collection("users").doc(parentId).collection("chores");

    // 1) Load children (for names/colors)
    childrenRef.get()
        .then(childrenSnap => {
            const childMap = {}; // childId -> { name, color, ... }
            childrenSnap.forEach(doc => {
                childMap[doc.id] = doc.data();
            });

            // 2) Load COMPLETED chores (these are unpaid by definition)
            return choresRef
                .where("status", "==", "COMPLETED")
                .orderBy("updatedAt", "desc")
                .get()
                .then(choreSnap => ({ childMap, choreSnap }));
        })
        .then(({ childMap, choreSnap }) => {
            container.innerHTML = "";

            if (choreSnap.empty) {
                container.innerHTML = "<p class='text-gray-500'>No completed chores waiting for payout.</p>";
                return;
            }

            // 3) Group chores by childId
            const grouped = {}; // childId -> array of chores
            choreSnap.forEach(doc => {
                const chore = doc.data();
                const childId = chore.assignedToChildId;

                // Only chores assigned to a child should show here
                if (!childId) return;

                if (!grouped[childId]) grouped[childId] = [];
                grouped[childId].push({ id: doc.id, ...chore });
            });

            const childIds = Object.keys(grouped);
            if (childIds.length === 0) {
                container.innerHTML = "<p class='text-gray-500'>No completed chores assigned to a child.</p>";
                return;
            }

            // 4) Render sections per child
            childIds.forEach(childId => {
                const child = childMap[childId] || { name: "Unknown Child" };
                const chores = grouped[childId];

                let totalCents = 0;

                const section = document.createElement("div");
                section.className = "mb-8 p-4 bg-white rounded-lg shadow space-y-4";

                const header = document.createElement("h3");
                header.className = "text-xl font-semibold text-pink-600";
                header.innerText = child.name;
                section.appendChild(header);

                const tableWrap = document.createElement("div");
                tableWrap.className = "overflow-x-auto";

                let html = `
          <table class="min-w-full text-sm border border-gray-300 rounded">
            <thead class="bg-gray-100">
              <tr>
                <th class="text-left px-4 py-2 border-b">Chore</th>
                <th class="text-left px-4 py-2 border-b">Reward</th>
                <th class="text-left px-4 py-2 border-b">Date</th>
              </tr>
            </thead>
            <tbody>
        `;

                chores.forEach(chore => {
                    totalCents += Number(chore.rewardCents || 0);

                    // Use chore.date if present, otherwise fall back to completedAt
                    let displayDate = chore.date || "—";
                    if (!chore.date && chore.completedAt?.toDate) {
                        displayDate = chore.completedAt.toDate().toDateString();
                    }

                    html += `
            <tr>
              <td class="px-4 py-2 border-t">${chore.title || "Untitled"}</td>
              <td class="px-4 py-2 border-t">$${(Number(chore.rewardCents || 0) / 100).toFixed(2)}</td>
              <td class="px-4 py-2 border-t">${displayDate}</td>
            </tr>
          `;
                });

                html += `
            </tbody>
            <tfoot>
              <tr class="bg-gray-50 font-semibold">
                <td class="px-4 py-2 border-t">Total</td>
                <td class="px-4 py-2 border-t" colspan="2">$${(totalCents / 100).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        `;

                tableWrap.innerHTML = html;
                section.appendChild(tableWrap);

                // Pay button
                const payButton = document.createElement("button");
                payButton.className = "bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded";
                payButton.innerText = "Mark as Paid";
                payButton.onclick = () => recordPayout(childId, child.name, totalCents / 100);
                section.appendChild(payButton);

                container.appendChild(section);
            });
        })
        .catch(err => {
            console.error("Error loading chore history:", err);
            container.innerHTML = `<p class="text-red-500">Error loading chore history: ${err.message}</p>`;
        });
}

window.addChild = function () {
    console.log("🟣 addChild called");

    const nameInput = document.getElementById("new-child-name");
    const pinInput = document.getElementById("new-child-pin");

    if (!nameInput || !pinInput) {
        alert("Child name or PIN input not found.");
        return;
    }

    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!name || (pin && !/^\d{4}$/.test(pin))) {
        alert("Enter a child name and, if desired, a 4-digit PIN.");
        return;
    }

    if (!parentId) {
        alert("Not authenticated — please log in again.");
        return;
    }

    db.collection("users")
        .doc(parentId)
        .collection("children")
        .add({
            name,
            ...(pin ? { pin } : {}),
            icon: "piggy_onecoin_smug.png", // optional default
            color: "#B5EAD7",               // optional default
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
    .then(() => {
        alert("Child added!");
        nameInput.value = "";
        pinInput.value = "";
        location.reload();
    })
    .catch(err => {
        console.error("Error adding child:", err);
        alert("Error adding child: " + err.message);
    });
};


document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("add-child-button");
    if (btn) {
        console.log("🟢 Binding addChild to button");
        btn.addEventListener("click", window.addChild);
    } else {
        console.warn("⚠️ Add Child button not found");
    }
});


async function recordPayout(childId, childName, amountDollars) {
    if (!parentId) {
        alert("Parent not loaded yet. Please try again.");
        return;
    }
    const method = prompt(`How did you pay ${childName}? (Cash, Robux, etc.)`);
    if (!method) {
        alert("Payment method required.");
        return;
    }

    const dateStr = prompt(
        "Enter payment date (YYYY-MM-DD)",
        new Date().toISOString().split("T")[0]
    );
    if (!dateStr) {
        alert("Payment date required.");
        return;
    }

    const amountCents = Math.round(Number(amountDollars) * 100);

    try {
        const choresRef = db.collection("users").doc(parentId).collection("chores");
        const archiveRef = db.collection("users").doc(parentId).collection("archived_chores");
        const payoutsRef = db.collection("users").doc(parentId).collection("payouts");

        // 1) Get COMPLETED chores for this child (unpaid)
        const completedSnap = await choresRef
            .where("assignedToChildId", "==", childId)
            .where("status", "==", "COMPLETED")
            .get();

        if (completedSnap.empty) {
            alert(`No completed chores found for ${childName}.`);
            return;
        }

        // 2) Archive + delete in a batch (Firestore max 500 ops/batch)
        const batch = db.batch();
        const archivedIds = [];
        const paidAt = firebase.firestore.Timestamp.fromDate(new Date(dateStr));

        completedSnap.forEach(choreDoc => {
            const chore = choreDoc.data();

            // Create a new archive doc id
            const newArchiveDoc = archiveRef.doc();
            archivedIds.push(newArchiveDoc.id);

            batch.set(newArchiveDoc, {
                sourceChoreId: choreDoc.id,

                title: chore.title,
                type: chore.type,
                rewardCents: chore.rewardCents,
                date: chore.date,

                assignedToChildId: chore.assignedToChildId || null,
                completedAt: chore.completedAt || null,

                archiveReason: "PAID",
                archivedAt: firebase.firestore.FieldValue.serverTimestamp(),

                paidAt: paidAt,
                paidByParentId: parentId,

                deletedAt: null,
                deletedByParentId: null,
                deleteReason: null
            });

            // Remove from active chores
            batch.delete(choreDoc.ref);
        });

        // 3) Create payout record
        const payoutDoc = payoutsRef.doc();
        batch.set(payoutDoc, {
            payday: dateStr,
            method: method,

            totalPaidCents: amountCents,

            byChild: {
                [childId]: {
                    paidCents: amountCents,
                    choreCount: completedSnap.size
                }
            },

            archivedChoreIds: archivedIds,

            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdByParentId: parentId
        });

        await batch.commit();

        alert(`Marked $${(amountCents / 100).toFixed(2)} as paid to ${childName} via ${method}`);

        // Refresh UI
        loadChoreHistory();

        const dropdown = document.getElementById("history-child-select");
        if (dropdown && dropdown.value === childId) {
            loadArchivedChores(childId);
        }
    } catch (err) {
        console.error("Error during payout:", err);
        alert("Error recording payout: " + err.message);
    }
}

function setupCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
        console.warn("Calendar container not found.");
        return;
    }
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [] // We'll load events dynamically below
    });

    calendar.render();
    console.log("Calendar rendered.");
    // TODO: calendar uses old schema; refactor to parent-owned chores before enabling
    //loadChoreEvents(calendar);
}

window.addEventListener("load", setupCalendar);

function loadChoreEvents(calendar) {
    const colors = {}; // cache child colors
    
    // 1. Get all children and their assigned colors
    db.collection("users").where("role", "==", "child").get()
        .then(snapshot => {
            const children = [];
            snapshot.forEach(doc => {
                const child = doc.data();
                child.id = doc.id;
                color: chore.paid ? "#D1D5DB" : colors[child.id] // gray if paid
                if (!child.color) {
                    // Assign a random pastel color if missing
                    const randomColor = getRandomColor();
                    db.collection("users").doc(child.id).update({ color: randomColor });
                    child.color = randomColor;
                }

                colors[child.id] = child.color;
                children.push(child);
            });

            // 2. Load chores for each child
            children.forEach(child => {
                db.collection("users").doc(child.id).collection("chores")
                    .get()
                    .then(choreSnap => {
                        choreSnap.forEach(choreDoc => {
                            const chore = choreDoc.data();
                            const assignedAt = chore.assignedAt?.toDate?.();

                            if (assignedAt) {
                                calendar.addEvent({
                                    title: chore.chore,
                                    start: assignedAt,
                                    color: colors[child.id], // Child's color
                                    allDay: true
                                });
                            }
                        });
                    });
            });
        })
    // Load payday from config and add it to the calendar
    db.collection("users").doc(parentId).collection("settings").doc("payday").get()
    .then(doc => {
        if (!doc.exists) return;

        const data = doc.data();
        let payday = null;

        if (data.paydayType === "manual" && data.nextPayday && typeof data.nextPayday.toDate === "function") {
            payday = data.nextPayday.toDate();
        } else if (data.paydayType === "recurring" && data.dayOfWeek) {
            // Find the upcoming occurrence of the recurring day
            const today = new Date();
            const dayMap = {
                Sunday: 0,
                Monday: 1,
                Tuesday: 2,
                Wednesday: 3,
                Thursday: 4,
                Friday: 5,
                Saturday: 6
            };
            const target = dayMap[data.dayOfWeek];
            const delta = (target - today.getDay() + 7) % 7;
            payday = new Date(today);
            payday.setDate(today.getDate() + delta);
        }

        if (payday) {
            calendar.addEvent({
                title: "💰 Payday",
                start: payday,
                allDay: true,
                color: "#34d399" // nice green
            });
        }
    })
    .catch(err => {
        console.error("Error loading payday for calendar:", err);
    });        
}

function getRandomColor() {
    // Random nice pastel colors
    const colors = [
        "#FFB6B9", "#FFDAC1", "#E2F0CB", "#B5EAD7",
        "#C7CEEA", "#F5C7B8", "#F2B5D4", "#C3F2B5"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function loadArchivedChores(childId) {
    const container = document.getElementById("archived-history-table");
    container.innerHTML = "<p>Loading archived chores...</p>";

    db.collection("users")
        .doc(parentId)
        .collection("archived_chores")
        .where("assignedToChildId", "==", childId)
        .orderBy("archivedAt", "desc")
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = "<p class='text-gray-500'>No archived chores found.</p>";
                return;
            }

            let html = `
    <table class="min-w-full text-sm border border-gray-300 rounded">
        <thead class="bg-gray-100">
        <tr>
            <th class="text-left px-4 py-2 border-b">Chore</th>
            <th class="text-left px-4 py-2 border-b">Reward</th>
            <th class="text-left px-4 py-2 border-b">Date</th>
            <th class="text-left px-4 py-2 border-b">Outcome</th>
        </tr>
        </thead>
        <tbody>
    `;

            snapshot.forEach(doc => {
                const a = doc.data();
                const outcome = a.archiveReason === "PAID" ? "Paid" : "Deleted";
                html += `
        <tr>
        <td class="px-4 py-2 border-t">${a.title}</td>
        <td class="px-4 py-2 border-t">$${(a.rewardCents / 100).toFixed(2)}</td>
        <td class="px-4 py-2 border-t">${a.date}</td>
        <td class="px-4 py-2 border-t">${outcome}</td>
        </tr>
    `;
            });

            html += "</tbody></table>";
            container.innerHTML = html;
        })
        .catch(err => {
            container.innerHTML = `<p class="text-red-500">Error loading archived chores: ${err.message}</p>`;
        });
}

document.addEventListener("DOMContentLoaded", () => {
  // existing child button logic...

  const recurringCheckbox = document.getElementById("is-recurring");
  const recurringOptions = document.getElementById("recurring-options");
  const frequencySelect = document.getElementById("recurring-frequency");
  const customIntervalContainer = document.getElementById("custom-interval-container");

  if (recurringCheckbox && recurringOptions) {
    recurringCheckbox.addEventListener("change", () => {
      recurringOptions.classList.toggle("hidden", !recurringCheckbox.checked);
    });
  }

  if (frequencySelect && customIntervalContainer) {
    frequencySelect.addEventListener("change", () => {
      const isCustom = frequencySelect.value === "everyXDays";
      customIntervalContainer.classList.toggle("hidden", !isCustom);
    });
  }
});

function generateRecurringChores() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // midnight

    db.collection("users").where("role", "==", "child").get().then(snapshot => {
        snapshot.forEach(childDoc => {
            const childId = childDoc.id;
            const choreRef = db.collection("users").doc(childId).collection("chores");

            choreRef.where("recurring", "==", true).get().then(choreSnap => {
                choreSnap.forEach(doc => {
                    const chore = doc.data();
                    const docRef = choreRef.doc(doc.id);
                    const last = chore.lastGenerated?.toDate?.() || chore.assignedAt?.toDate?.() || new Date(0);
                    const next = new Date(last);

                    let shouldGenerate = false;

                    switch (chore.frequency) {
                        case "daily":
                            next.setDate(last.getDate() + 1);
                            shouldGenerate = today >= next;
                            break;
                        case "weekly":
                            next.setDate(last.getDate() + 7);
                            shouldGenerate = today >= next;
                            break;
                        case "monthly":
                            next.setMonth(last.getMonth() + 1);
                            shouldGenerate = today >= next;
                            break;
                        case "everyXDays":
                            if (chore.interval) {
                                next.setDate(last.getDate() + parseInt(chore.interval));
                                shouldGenerate = today >= next;
                            }
                            break;
                    }

                    if (shouldGenerate) {
                        // Create new chore
                        choreRef.add({
                            ...chore,
                            complete: false,
                            recurring: false, // don't let copies keep repeating
                            assignedAt: new Date()
                        });

                        // Update original lastGenerated
                        docRef.update({
                            lastGenerated: new Date()
                        });
                    }
                });
            });
        });
    });
}


