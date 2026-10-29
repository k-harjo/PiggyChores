// JavaScript source code
// seed.js
import { db } from "./firebase-config.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "firebase/firestore";

export async function seedData(parentId, childId) {
    // 1️⃣ Active chore
    const choreRef = await addDoc(
        collection(db, "users", parentId, "chores"),
        {
            parentId,
            title: "Clean Room",
            type: "DAILY",
            rewardCents: 300,
            date: "2026-01-07",
            status: "UNASSIGNED",
            assignedToChildId: null,
            assignedByParentId: parentId,
            completedAt: null,
            completedByChildId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }
    );

    // 2️⃣ Archived chore (paid)
    const archiveRef = await addDoc(
        collection(db, "users", parentId, "archived_chores"),
        {
            parentId,
            sourceChoreId: choreRef.id,
            title: "Vacuum Mom’s car",
            type: "EXTRA",
            rewardCents: 500,
            date: "2026-01-06",
            assignedToChildId: childId,
            completedAt: serverTimestamp(),
            archiveReason: "PAID",
            archivedAt: serverTimestamp(),
            paidAt: serverTimestamp(),
            paidByParentId: parentId,
            deletedAt: null,
            deletedByParentId: null,
            deleteReason: null,
        }
    );

    // 3️⃣ Payout
    await addDoc(
        collection(db, "users", parentId, "payouts"),
        {
            parentId,
            periodStart: "2026-01-01",
            periodEnd: "2026-01-07",
            payday: "2026-01-07",
            totalPaidCents: 500,
            byChild: {
                [childId]: {
                    paidCents: 500,
                    choreCount: 1,
                },
            },
            archivedChoreIds: [archiveRef.id],
            createdAt: serverTimestamp(),
            createdByParentId: parentId,
        }
    );

    console.log("✅ Firestore seeded");
}

