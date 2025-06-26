# 🐷 PiggyChores

PiggyChores is a private web app for small families to assign, track, and pay for chores. Parents can manage tasks, set payout schedules, and monitor progress, while kids can view their assigned chores, claim extra ones for bonuses, and track their earnings.

This project is lovingly themed around pigs and piggy banks, featuring a family-friendly UI with custom avatars.

---

## ✨ Features

### 👨‍👩‍👧 Parent Dashboard
- Assign chores to children or make them public
- View a calendar of all chore assignments
- Track chore history and payouts
- Set one-time or recurring payday dates
- Add and manage child accounts
- Log out securely

### 🧒 Child Dashboard
- See assigned chores and mark them complete
- View total earnings since last payday
- Claim extra public chores for bonus cash
- Choose a piggy avatar to represent themselves

---

## 🗺️ Site Map

| Page            | Description                          | Access Role |
|-----------------|--------------------------------------|-------------|
| `index.html`    | Login/Sign-up landing page           | All         |
| `parent.html`   | Main parent dashboard                | Parent      |
| `child.html`    | Main child dashboard                 | Child       |
| `child-login.html` | PIN login for kids               | Child       |

---

## 🔒 Authentication & Data

- Firebase Authentication is used for login
- Firestore stores user profiles, chore data, payouts, and shared chore pools

---

## 🗂️ Project Structure
/piggychores-app/
│
├── index.html
├── parent.html
├── child.html
├── child-login.html
│
├── /piggies/ # PNG pig avatars
│
├── parent.js # Parent dashboard logic
├── child.js # Child dashboard logic
├── firebase-config.js # Firebase setup
│
└── README.md # You're here!

---

## 🔥 Firestore Collections

- `/users` – user accounts (`role: "parent"` or `"child"`)
- `/users/{childId}/chores` – assigned chores for each child
- `/users/{childId}/payouts` – payout records for each child
- `/shared_chores` – public, unclaimed chores
- `/config/payday` – stores next payday or recurring day

---

## 🚀 Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/piggychores.git

2. Create a Firebase project, set up Firestore + Auth

3. Add your Firebase config to firebase-config.js

4. Open index.html in a browser to start using the app

🎨 Credits
Created with love by a parent for their own kids 🐽❤️
Built using HTML, TailwindCSS, JavaScript, and Firebase.

---

📜 License
This project is private and not intended for public redistribution.

