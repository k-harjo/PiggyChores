console.log("✅ parent.js script loaded");

auth.onAuthStateChanged(user => {
    if (user) {
        const uid = user.uid;
        loadChoreHistory();

        // Get parent info
        db.collection("users").doc(uid).get().then(doc => {
            if (doc.exists) {
                document.getElementById("parent-name").innerText = `Hello, ${doc.data().name}`;
            }
        });

        // Load children list
        db.collection("users").where("role", "==", "child").get().then(snapshot => {
            const select = document.getElementById("child-select");
            snapshot.forEach(doc => {
                const option = document.createElement("option");
                option.value = doc.id;
                option.text = doc.data().name;
                select.appendChild(option);
            });

            // Populate archived chore filter dropdown
            const historySelect = document.getElementById("history-child-select");
            if (historySelect) {
                snapshot.forEach(doc => {
                    const option = document.createElement("option");
                    option.value = doc.id;
                    option.text = doc.data().name;
                    historySelect.appendChild(option);
                });

                historySelect.addEventListener("change", () => {
                    const selectedChildId = historySelect.value;
                    if (selectedChildId) {
                        loadArchivedChores(selectedChildId);
                    } else {
                        document.getElementById("archived-history-table").innerHTML =
                            "<p class='text-gray-500'>Select a child to view paid chores.</p>";
                    }
                });
            }
        });

        // ✅ ADD THIS LINE RIGHT HERE
        generateRecurringChores();

    } else {
        window.location.href = "index.html";
    }
});


function assignChore() {
    const assignButton = document.querySelector("button[onclick='assignChore()']");
    assignButton.disabled = true;

    const childId = document.getElementById("child-select").value;
    const chore = document.getElementById("chore").value;
    const reward = parseFloat(document.getElementById("reward").value);
    const isRecurring = document.getElementById("is-recurring").checked;
    const frequency = document.getElementById("recurring-frequency").value;
    const interval = parseInt(document.getElementById("custom-interval").value);

    if (!chore || isNaN(reward)) {
        alert("Please enter a valid chore and reward.");
        assignButton.disabled = false;
        return;
    }

    const choreData = {
        chore,
        reward,
        complete: false,
        assignedAt: new Date()
    };

    if (isRecurring) {
        choreData.recurring = true;
        choreData.frequency = frequency;
        if (frequency === "everyXDays") {
            if (isNaN(interval) || interval < 1) {
                alert("Please enter a valid interval for recurring chores.");
                assignButton.disabled = false;
                return;
            }
            choreData.interval = interval;
        }
        choreData.lastGenerated = new Date(); // useful for later recurrence generation
    }

    if (childId) {
        db.collection("users").doc(childId).collection("chores").add(choreData)
    } else {
        db.collection("shared_chores").add(choreData)
    
        .then(() => {
            alert("Chore assigned!");
            document.getElementById("chore").value = "";
            document.getElementById("reward").value = "";
            document.getElementById("is-recurring").checked = false;
            document.getElementById("recurring-options").classList.add("hidden");
            assignButton.disabled = false;
        })
        .catch(error => {
            alert("Error assigning chore: " + error.message);
            assignButton.disabled = false;
        });
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
            nextPayday: new Date(manualDate)
        };
    } else if (recurringDay) {
        paydayData = {
            paydayType: "recurring",
            dayOfWeek: recurringDay
        };
    }

    db.collection("config").doc("payday")
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

    if (!name || pin.length !== 4 || isNaN(pin)) {
        alert("Please enter a valid name and a 4-digit numeric PIN.");
        return;
    }

    const parentId = auth.currentUser?.uid;
    if (!parentId) {
        alert("Not authenticated — please log in again.");
        return;
    }

    db.collection("users").add({
        name,
        pin,
        role: "child",
        parentId,
        createdAt: new Date()
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

function loadChoreHistory() {
    const container = document.getElementById("history-container");
    container.innerHTML = "<p>Loading...</p>";

    // Step 1: Get all children
    db.collection("users").where("role", "==", "child").get()
        .then(snapshot => {
            container.innerHTML = ""; // Clear loading message

            snapshot.forEach(childDoc => {
                const child = childDoc.data();
                const childId = childDoc.id;


                // Step 2: Get that child's completed chores
                db.collection("users").doc(childId).collection("chores")
                    .where("complete", "==", true)
                    .where("paid", "==", false) // Only show unpaid chores
                    .orderBy("assignedAt", "desc")
                    .get()
                    .then(choreSnap => {
                        if (choreSnap.empty) return;

                        const section = document.createElement("div");
                        section.className = "mb-8 p-4 bg-white rounded-lg shadow space-y-4";
                        let childTotal = 0;

                        section.innerHTML = `
                            <h3 class="text-xl font-semibold text-pink-600">${child.name}</h3>
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-sm border border-gray-300 rounded">
                                    <thead class="bg-gray-100">
                                        <tr>
                                            <th class="text-left px-4 py-2 border-b">Chore</th>
                                            <th class="text-left px-4 py-2 border-b">Reward</th>
                                            <th class="text-left px-4 py-2 border-b">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody id="chore-rows-${childId}">
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-gray-50 font-semibold">
                                            <td class="px-4 py-2 border-t">Total</td>
                                            <td class="px-4 py-2 border-t" colspan="2">$${childTotal.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                        `;

                        const table = section.querySelector("table");

                        choreSnap.forEach(choreDoc => {
                            const chore = choreDoc.data();
                            const date = chore.assignedAt?.toDate?.().toDateString() || "Unknown";
                            childTotal += chore.reward;

                            const row = document.createElement("tr");
                            row.innerHTML = `
                                <td class="px-4 py-2 border-t">${chore.chore}</td>
                                <td class="px-4 py-2 border-t">$${chore.reward.toFixed(2)}</td>
                                <td class="px-4 py-2 border-t">${date}</td>
                            `;
                            const tbody = section.querySelector(`#chore-rows-${childId}`);
                            tbody.appendChild(row);
                        });

                        // Add total row
                        const totalRow = document.createElement("tr");
                        totalRow.innerHTML = `
                            <td><strong>Total</strong></td>
                            <td colspan="2"><strong>$${childTotal.toFixed(2)}</strong></td>
                            `;
                        table.appendChild(totalRow);

                        const payButton = document.createElement("button");
                        payButton.className = "bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded";
                        payButton.innerText = "Mark as Paid";
                        payButton.onclick = () => recordPayout(childId, child.name, childTotal);
                        section.appendChild(payButton);

                        container.appendChild(section); // move this here, after the button


                    });
            });
        })
        .catch(error => {
            container.innerHTML = `<p>Error loading chore history: ${error.message}</p>`;
        });
}

function recordPayout(childId, childName, amount) {
    const method = prompt(`How did you pay ${childName}? (Cash, Robux, etc.)`);
    if (!method) {
        alert("Payment method required.");
        return;
    }

    const date = prompt("Enter payment date (YYYY-MM-DD)", new Date().toISOString().split("T")[0]);
    if (!date) {
        alert("Payment date required.");
        return;
    }

    const payoutDate = new Date(date);

    const childRef = db.collection("users").doc(childId);
    const choresRef = childRef.collection("chores");
    const archiveRef = childRef.collection("archived_chores");

    // Add payout record
    childRef.collection("payouts").add({
        amount: amount,
        method: method,
        date: payoutDate,
        recordedAt: new Date()
    }).then(() => {
        // Now move completed chores to archive
        return choresRef.where("complete", "==", true).get();
    }).then(snapshot => {
        const batch = db.batch();

        snapshot.forEach(doc => {
            const choreData = doc.data();
            const choreId = doc.id;
            const paidAt = new Date();

            // ✅ Add to archive
            const archivedDoc = archiveRef.doc(choreId);
            batch.set(archivedDoc, {
                ...choreData,
                paid: true,
                paidAt: paidAt
            });

            // ✅ Mark as paid (but do NOT delete it)
            batch.update(choresRef.doc(choreId), {
                paid: true,
                paidAt: paidAt
            });
        });

        return batch.commit();
    }).then(() => {
        alert(`Marked $${amount.toFixed(2)} as paid to ${childName} via ${method}`);
        loadChoreHistory();

        const dropdown = document.getElementById("history-child-select");
        if (dropdown && dropdown.value === childId) {
            loadArchivedChores(childId);
        }
    }).catch(err => {
        console.error("Error during payout:", err);
        alert("Error recording payout: " + err.message);
    });
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
    loadChoreEvents(calendar);
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
    db.collection("config").doc("payday").get()
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

    db.collection("users").doc(childId).collection("archived_chores")
        .orderBy("assignedAt", "desc")
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = "<p class='text-gray-500'>No archived chores found for this child.</p>";
                return;
            }

            let html = `
                <table class="min-w-full text-sm border border-gray-300 rounded">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="text-left px-4 py-2 border-b">Chore</th>
                        <th class="text-left px-4 py-2 border-b">Reward</th>
                        <th class="text-left px-4 py-2 border-b">Assigned</th>
                        <th class="text-left px-4 py-2 border-b">Paid On</th>
                    </tr>
                </thead>
                    <tbody>
            `;

            snapshot.forEach(doc => {
                const chore = doc.data();
                const date = chore.assignedAt?.toDate?.().toDateString() || "Unknown";
                const paidDate = chore.paidAt?.toDate?.().toDateString() || "Unknown";

            html += `
                <tr>
                    <td class="px-4 py-2 border-t">${chore.chore}</td>
                    <td class="px-4 py-2 border-t">$${chore.reward.toFixed(2)}</td>
                    <td class="px-4 py-2 border-t">${date}</td>
                    <td class="px-4 py-2 border-t">${paidDate}</td>
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

