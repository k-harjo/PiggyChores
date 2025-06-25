auth.onAuthStateChanged(user => {
    if (user) {
        const uid = user.uid;

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
        });
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

function addChild() {
    const name = document.getElementById("new-child-name").value.trim();
    const pin = document.getElementById("new-child-pin").value.trim();

    if (!name || pin.length !== 4 || isNaN(pin)) {
        alert("Please enter a valid name and 4-digit PIN.");
        return;
    }

    // Create a new Firestore document for this child
    db.collection("users").add({
        name: name,
        pin: pin,
        role: "child",
        createdAt: new Date()
    })
        .then(() => {
            alert("Child added!");
            document.getElementById("new-child-name").value = "";
            document.getElementById("new-child-pin").value = "";
            location.reload(); // Refresh to show child in dropdown
        })
        .catch(error => {
            alert("Error adding child: " + error.message);
        });
}
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
                    .orderBy("assignedAt", "desc")
                    .get()
                    .then(choreSnap => {
                        if (choreSnap.empty) return;

                        const section = document.createElement("div");
                        section.innerHTML = `
              <h3>${child.name}</h3>
              <table border="1" cellpadding="5">
                <tr><th>Chore</th><th>Reward</th><th>Date</th></tr>
              </table>
            `;
                        const table = section.querySelector("table");

                        let childTotal = 0;

                        choreSnap.forEach(choreDoc => {
                            const chore = choreDoc.data();
                            const date = chore.assignedAt?.toDate?.().toDateString() || "Unknown";
                            childTotal += chore.reward;

                            const row = document.createElement("tr");
                            row.innerHTML = `
                <td>${chore.chore}</td>
                <td>$${chore.reward.toFixed(2)}</td>
                <td>${date}</td>
              `;
                            table.appendChild(row);
                        });

                        // Add total row
                        const totalRow = document.createElement("tr");
                        totalRow.innerHTML = `
                      <td><strong>Total</strong></td>
                      <td colspan="2"><strong>$${childTotal.toFixed(2)}</strong></td>
                    `;
                        table.appendChild(totalRow);

                        const payButton = document.createElement("button");
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

        db.collection("users").doc(childId).collection("payouts").add({
            amount: amount,
            method: method,
            date: new Date(date),
            recordedAt: new Date()
        })
            .then(() => {
                alert(`Marked $${amount.toFixed(2)} as paid to ${childName} via ${method}`);
            })
            .catch(err => {
                alert("Error recording payout: " + err.message);
            });
    }
}

// Initialize recurrence UI listeners once the DOM is ready
document.addEventListener("DOMContentLoaded", function () {
    const recurringCheckbox = document.getElementById("is-recurring");
    const frequencySelect = document.getElementById("recurring-frequency");

    if (recurringCheckbox && frequencySelect) {
        recurringCheckbox.addEventListener("change", function () {
            document.getElementById("recurring-options").classList.toggle("hidden", !this.checked);
        });

        frequencySelect.addEventListener("change", function () {
            const showCustom = this.value === "everyXDays";
            document.getElementById("custom-interval-container").classList.toggle("hidden", !showCustom);
        });
    }
});
// FullCalendar Setup
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
        .catch(error => {
            console.error("Error loading calendar chores:", error);
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
