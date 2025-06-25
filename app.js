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

            // Get user role from Firestore
            return db.collection("users").doc(user.uid).get();
        })
        .then(doc => {
            if (doc.exists) {
                const role = doc.data().role;
                alert(`Logged in as ${role}`);
                if (role === "parent") {
                    window.location.href = "parent.html";
                } else if (role === "child") {
                    window.location.href = "child.html";
                } else {
                    alert("Unknown role! Please check Firestore.");
                }
            } else {
                alert("User data not found in Firestore.");
            }
        })
        .catch(error => alert(error.message));
}
