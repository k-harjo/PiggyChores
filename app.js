function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            alert("Logged in!");
            console.log(userCredential.user);
        })
        .catch(error => alert(error.message));
}

function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
        const user = userCredential.user;
        return db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const role = doc.data().role;
            alert(`Logged in as ${role}`);
            if (role === "parent") {
            window.location.href = "parent.html";
            } else if (role === "child") {
            window.location.href = "child.html";
            } else {
            alert("Unknown role.");
            }
        } else {
            // Auto-create missing user doc (as parent by default)
            return db.collection("users").doc(user.uid).set({
            email: user.email,
            name: email.split("@")[0],
            role: "parent"
            }).then(() => {
            alert("Welcome! User profile created.");
            window.location.href = "parent.html";
            });
        }
        });
    })
    .catch(error => alert(error.message));

}

function signup() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            // Create user profile in Firestore with default role
            return db.collection("users").doc(user.uid).set({
                email: user.email,
                role: "parent", // default new users to parent
                name: email.split("@")[0]
            });
        })
        .then(() => {
            alert("Signup successful! Redirecting...");
            window.location.href = "parent.html";
        })
        .catch(error => {
            alert("Signup error: " + error.message);
        });
}
