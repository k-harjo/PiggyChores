# PiggyChores

A small, mobile-friendly chore and allowance app for one family.

## Direction

Keep JavaScript and Firebase. Reuse the piggy artwork and useful existing screens.
Prioritize a complete, reliable chore cycle over extra features. Family members
should be able to use the app from their phones away from home.

Existing Firebase data is test data; no balance migration is required. Do not
delete remote data as part of local development. Existing uncommitted source
changes should be preserved while making incremental repairs.

## First version

- Parent signs in and manages child profiles.
- Each child has restricted access separate from the parent's session.
- Parent creates a chore with an amount and assigns it to a child.
- Child submits the chore for approval.
- Parent approves it or returns it for more work.
- Only approved chores count toward unpaid earnings.
- Parent records a payment, which reduces the balance and remains in history.

Store money as integer cents. Recording a payment means tracking money paid
outside the app, not transferring money.

## Implementation order

### 1. Establish access control

Inspect the deployed Firebase Authentication configuration and Firestore rules
before selecting the child sign-in mechanism. Those settings are not included
in this checkout.

Replace the child flow that reuses the parent's Firebase session. The current
setup uses a separate Email/Password account per child, with the Firebase Auth
UID as the child profile document ID. The parent creates the Auth account in
the Firebase Console, then links its UID in the parent screen. Children enter
the parent's Firebase Auth UID as their family code. Enforce household
membership and chore permissions in Firestore rules, not browser state.
Readable PINs are not used; child accounts must not be linked to profiles that
still contain a legacy `pin` field.

Add Firebase project, hosting, rules, and emulator configuration to source
control. Verify that a child cannot read private parent data, change rewards,
approve work, record payments, or access another child's private data.

### 2. Complete the chore cycle

Use explicit states:

`ASSIGNED -> PENDING_APPROVAL -> APPROVED -> PAID`

Parent rejection returns pending work to `ASSIGNED`. Only the assigned child
can submit work; only a parent can approve or pay. Guard transitions against
duplicate taps and concurrent updates.

Compute unpaid earnings from approved, unpaid work. Record payments and the
corresponding chore changes atomically so retries cannot pay the same work
twice. Start with paying the full approved balance; defer partial payments.

### 3. Make it comfortable on phones

Keep the parent screen focused on assignments, pending approvals, balances,
and payment history. Keep the child screen focused on their chores, pending
work, and earnings. Preserve the piggy artwork. Provide clear loading, empty,
and failure states and prevent duplicate submissions.

### 4. Verify and publish

Test permissions and the full chore cycle against Firebase emulators, including
rejected work, repeat submissions, and duplicate payment attempts. Then verify
the screens on phone-sized viewports. Deploy with HTTPS after checking actual
Firebase settings and establishing a backup/export process.

## Deferred

Public registration, multiple households, recurring chore automation, calendars,
payment integrations, and additional customization can wait until the core
cycle is working.

## Current checkout

The app consists of HTML pages and browser JavaScript using Firebase Auth and
Firestore. It loads Firebase and Tailwind from CDNs. There is currently no
checked-in package manifest, automated test setup, Firebase deployment
configuration, or emulator setup. A Firestore rules file is checked in with
parent access plus limited child access for linked child accounts.

Known issues from initial inspection:

- `app.js` defines `login()` twice.
- Child login now uses a separate Firebase account and a parent UID family code.
- Child profiles with legacy `pin` fields are denied child access until the
  parent removes the field.
- Child completion immediately counts as earnings without parent approval.
- Live Firebase configuration is embedded in the app; use emulators or a
  separate test project when exercising writes during development.

This is a source inspection, not confirmation of the deployed app's behavior
or its current server-side permissions.

