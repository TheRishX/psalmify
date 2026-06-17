# Security Specification: Psalmify Firestore Security

## Data Invariants
1. **Songs Collection**:
   - Reads: Anyone (anonymous or signed-in) can read/list songs with `status == 'approved'`.
   - Creation: Any registered user can submit a track, which initializes with `status == 'pending'` and their email in `submittedBy`.
   - Modifying/Approving/Deleting: Only designated administrator (`therishx@gmail.com`) can approve or reject songs (by updating their status, fields, or deleting).

2. **Playlists Collection**:
   - Reads: Anyone can read approved playlists.
   - Creation: Any registered user can submit a custom playlist compilation which starts with `status == 'pending'`.
   - Updating/Deleting: Only designated administrator (`therishx@gmail.com`) can approve/moderated/delete playlists.

---

## The "Dirty Dozen" Payloads
These payloads attempt to corrupt the database or bypass access controls:

1. **Attempting an unauthenticated write to `/songs`**:
   `{ "title": "Attack", "artist": "Attacker", "rawLyrics": "..." }` with NULL auth.
2. **Attempting to self-approve a track during creation**:
   `{ "title": "Amazing Grace", "artist": "John Newton", "status": "approved", "submittedBy": "user@gmail.com" }` by a non-admin.
3. **Attempting to submit a track with spoofed submitter ID**:
   `{ "title": "Faith", "artist": "Hillsong", "status": "pending", "submittedBy": "victim@gmail.com" }` by authenticated user `attacker@gmail.com`.
4. **Attempting to modify another user's pending track without admin privileges**:
   `update { "title": "Hacked Title" }` by non-admin on a document where `submittedBy == "victimgmail.com"`.
5. **Attempting to bypass ID Poisoning checks by injecting gigantic IDs**:
   Creating `/songs/SOMELONGID` (longer than 128 characters) or with illegal characters like `$$$`.
6. **Attempting to create a song with missing required fields**:
   `{ "artist": "Hillsong" }` with missing `title` or `rawLyrics`.
7. **Attempting to self-modify the `submittedBy` email to someone else during update**:
   `update { "submittedBy": "someoneelse@gmail.com" }` by a non-admin.
8. **Attempting an unauthenticated create to `/playlists`**:
   `{ "name": "Curator Selection", "description": "curation" }` with NULL auth.
9. **Attempting to create a playlist with direct approval**:
   `{ "name": "Curator Mix", "description": "x", "status": "approved", "submittedBy": "user@gmail.com" }`.
10. **Attempting to spoof author email in a playlist creation**:
   `{ "name": "Spoofed", "description": "y", "status": "pending", "submittedBy": "admin@gmail.com" }` by authenticated user `user@gmail.com`.
11. **Updating a playlist's details when signed in as a non-admin**:
   `update { "name": "Hacked Mix" }` by a non-admin.
12. **Injecting an invalid data type into a playlist** (e.g. `songIds` as a boolean instead of an array):
   `{ "name": "Broken", "description": "broken", "songIds": true, "status": "pending", "submittedBy": "user@gmail.com" }`.

---

## Test Runner: firestore.rules.test.ts

An implementation of the test cases using the Google Firebase Rules Testing library.

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

describe("Psalmify Firestore Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "gen-lang-client-0356842658",
      firestore: {
        rules: require("fs").readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("should block unauthenticated creates in /songs", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const songDoc = doc(unauthedDb, "songs/test-song");
    await assertFails(setDoc(songDoc, {
      title: "Silent Night",
      artist: "Franz Gruber",
      rawLyrics: "...",
      status: "pending",
      submittedBy: "anonymous@gmail.com",
      createdAt: new Date().toISOString()
    }));
  });

  it("should block non-admin users from creating pre-approved tracks", async () => {
    const userDb = testEnv.authenticatedContext("user123", { email: "user@gmail.com" }).firestore();
    const songDoc = doc(userDb, "songs/test-song-2");
    await assertFails(setDoc(songDoc, {
      title: "Amazing Grace",
      artist: "Traditional",
      rawLyrics: "...",
      status: "approved",
      submittedBy: "user@gmail.com",
      createdAt: new Date().toISOString()
    }));
  });

  it("should allow a logged-in user to submit a pending track with their own email", async () => {
    const userDb = testEnv.authenticatedContext("user123", { email: "user@gmail.com" }).firestore();
    const songDoc = doc(userDb, "songs/valid-song");
    await assertSucceeds(setDoc(songDoc, {
      title: "Amazing Grace",
      artist: "Traditional",
      rawLyrics: "...",
      status: "pending",
      submittedBy: "user@gmail.com",
      createdAt: new Date().toISOString()
    }));
  });

  it("should prevent a non-admin from modifying/approving tracks", async () => {
    const userDb = testEnv.authenticatedContext("user123", { email: "user@gmail.com" }).firestore();
    const songDoc = doc(userDb, "songs/valid-song");
    await assertFails(updateDoc(songDoc, { status: "approved" }));
  });

  it("should allow the admin to approve tracks", async () => {
    const adminDb = testEnv.authenticatedContext("admin123", { email: "therishx@gmail.com" }).firestore();
    const songDoc = doc(adminDb, "songs/target-song");
    await assertSucceeds(updateDoc(songDoc, { status: "approved" }));
  });
});
```
