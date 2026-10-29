const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

const projectId = "demo-piggychores";
const parentId = "parent-a";
const childId = "child-a";
let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"),
    },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, `users/${parentId}`), {
        email: "parent@example.test",
        role: "parent",
      }),
      setDoc(doc(db, `users/${parentId}/children/${childId}`), {
        name: "Alex",
        pin: "1234",
        color: "#B5EAD7",
      }),
      setDoc(doc(db, `users/${parentId}/children/child-b`), {
        name: "Sam",
        color: "#C7CEEA",
      }),
      setDoc(doc(db, `users/${parentId}/chores/chore-a`), {
        title: "Make bed",
        rewardCents: 100,
        status: "ASSIGNED",
        assignedToChildId: childId,
      }),
      setDoc(doc(db, `users/${parentId}/settings/payday`), {
        paydayType: "manual",
      }),
      setDoc(doc(db, "config/payday"), { paydayType: "manual" }),
    ]);
  });
});

function signedInAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

test("parent can manage their household and child profiles", async () => {
  const db = signedInAs(parentId);
  await assertSucceeds(getDoc(doc(db, `users/${parentId}`)));
  await assertSucceeds(getDoc(doc(db, `users/${parentId}/children/${childId}`)));
  await assertSucceeds(getDocs(collection(db, `users/${parentId}/children`)));
  await assertSucceeds(updateDoc(doc(db, `users/${parentId}/chores/chore-a`), {
    rewardCents: 125,
  }));
  await assertSucceeds(getDoc(doc(db, `users/${parentId}/settings/payday`)));
});

test("child profiles are not separate Firebase accounts", async () => {
  const db = signedInAs(childId);
  await assertFails(getDoc(doc(db, `users/${parentId}/children/${childId}`)));
  await assertFails(getDoc(doc(db, `users/${parentId}/chores/chore-a`)));
});

test("a different signed-in account cannot access the household", async () => {
  const db = signedInAs("another-parent");
  await assertFails(getDoc(doc(db, `users/${parentId}`)));
  await assertFails(getDocs(collection(db, `users/${parentId}/children`)));
  await assertFails(updateDoc(doc(db, `users/${parentId}/chores/chore-a`), {
    rewardCents: 10000,
  }));
});

test("shared top-level configuration and unauthenticated access are denied", async () => {
  const parentDb = signedInAs(parentId);
  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(parentDb, "config/payday")));
  await assertFails(getDoc(doc(anonymousDb, `users/${parentId}/children/${childId}`)));
  await assertFails(getDoc(doc(anonymousDb, `users/${parentId}/chores/chore-a`)));
});

