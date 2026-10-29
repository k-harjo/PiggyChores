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
- Child chooses a profile within the signed-in parent's session; a PIN is optional.
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

Children use the parent's signed-in session and choose a profile in the app.
An optional profile PIN is a convenience prompt, not a separate Firebase
security boundary; Firestore sees the parent for all profile actions. There is
no child Firebase account setup or family code.

Add Firebase project, hosting, rules, and emulator configuration to source
control. Verify that a child cannot read private parent data, change rewards,
approve work, record payments, or access another child's private data.

Run the current Firestore access checks locally with `npm install` followed by
`npm run test:rules`. The first run downloads the Firestore emulator. These
checks use the demo project ID and do not connect to the live Firebase project.
For an app preview isolated from live accounts and data, run
`npx firebase emulators:start --project demo-piggychores`. The configured Auth,
Firestore, and Hosting emulators start together.

Firebase Hosting is configured to serve only the `public/` folder. It contains
the app pages, scripts, Firebase web config, and piggy images. The default CLI
project alias is `piggychores`; no Hosting or Firestore deployment has been run.

### 2. Complete the chore cycle

Use explicit states:

`ASSIGNED -> PENDING_APPROVAL -> COMPLETED (approved and unpaid) -> PAID`

Returning pending work sends it back to `ASSIGNED`. Children submit work;
parents approve it before it counts toward unpaid earnings. Parent review uses
a transaction so a stale or repeated approval cannot review the same chore
twice.

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
Firestore. It loads Firebase and Tailwind from CDNs. Firebase Hosting is
configured for `public/`; Firebase Hosting and Firestore have not been
deployed. The project includes Firestore rules, emulator setup, and a rule test
suite. The rules grant each signed-in account access to its own household data;
the app uses the parent's account for all child profile actions.

Known issues from initial inspection:

- `app.js` defines `login()` twice.
- Children use profiles within the parent session; optional PINs are checked
  in the app and do not restrict Firebase data access.
- Child completion immediately counts as earnings without parent approval.
- Live Firebase configuration is embedded in the app; use emulators or a
  separate test project when exercising writes during development.

This is a source inspection, not confirmation of the deployed app's behavior
or its current server-side permissions.

