# Security Specification: Role-Based Authentication

## 1. Data Invariants

1. **Role Immutability & Veracity**:
   - A document in the `users` collection must strictly have `role == 0` (UserRole.CITIZEN).
   - A document in the `officers` collection must strictly have `role == 1` (UserRole.MUNICIPAL_OFFICER).
   - Neither citizens nor officers can self-escalate, self-assign roles, or modify their `role` field after creation.

2. **Personal Profile Ownership**:
   - Only the authenticated user with `request.auth.uid == userId` can write to `users/{userId}` or `officers/{userId}`.
   - Profile updating is restricted to safe, non-sensitive fields (e.g., city, ward, photoURL, name, department, designation). Security/role flags cannot be mutated.

3. **Officer Activity State**:
   - Newly registered officers default to `active == true`.
   - Modifying the `active` status of an officer is blocked from the client to prevent rogue administrative hijacking.

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Cases)

Below are the 12 specific payloads representing attempts to violate the security invariants, all of which must return `PERMISSION_DENIED` on the database level.

### Case 1: Role Escalation via Citizen Signup
- **Description**: A citizen tries to register with `role = 1` (Municipal Officer) in the `users` collection.
- **Payload**:
  ```json
  {
    "uid": "victim_citizen_id",
    "name": "Attacker Citizen",
    "email": "attacker@citizen.in",
    "role": 1,
    "points": 100
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (users collection is strictly restricted to `role == 0`).

### Case 2: Shadow Field Injection (Citizen)
- **Description**: A citizen tries to inject an unauthorized `isAdmin` or `privileges` field.
- **Payload**:
  ```json
  {
    "uid": "victim_citizen_id",
    "name": "Attacker Citizen",
    "email": "attacker@citizen.in",
    "role": 0,
    "points": 25,
    "isAdmin": true
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (strict schema keys on creation).

### Case 3: Identity Hijacking (Citizen profile write as other user)
- **Description**: Authenticated User B attempts to create or overwrite User A's profile in the `users` collection.
- **Payload**:
  ```json
  {
    "uid": "user_A_id",
    "name": "User B",
    "email": "b@citizen.in",
    "role": 0,
    "points": 25
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (UID mismatch: `isOwner(userId)` fails).

### Case 4: Mutation of Restricted Gamification Fields (Citizen Update)
- **Description**: A citizen tries to modify their earned `points` or `badges` collection during a profile update.
- **Payload**:
  ```json
  {
    "points": 99999,
    "badges": ["Super Admin", "National Hero"]
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (affectedKeys must strictly be within `['name', 'photoURL', 'city', 'ward', 'lastLogin']`).

### Case 5: Role Spoofing in Officer Collection
- **Description**: An attacker tries to register as an officer but sets `role = 0` (Citizen) in the `officers` collection to bypass validation.
- **Payload**:
  ```json
  {
    "uid": "attacker_id",
    "name": "Attacker",
    "email": "attacker@municipal.in",
    "role": 0,
    "department": "Sanitation",
    "city": "Mumbai",
    "ward": "Ward A",
    "designation": "Executive",
    "active": true
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (officers collection is restricted to `role == 1`).

### Case 6: Deactivating Other Officer Profile
- **Description**: Officer B attempts to write to Officer A's profile to toggle their `active` state to `false`.
- **Payload**:
  ```json
  {
    "active": false
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (UID mismatch and `active` field mutation block).

### Case 7: Anonymous Guest attempting to Register as Officer
- **Description**: An unauthenticated or anonymous user tries to write to the `officers` collection.
- **Payload**:
  ```json
  {
    "uid": "guest_id",
    "role": 1,
    "active": true
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (anonymous auth cannot meet email/password verified identity credentials for officers).

### Case 8: Officer profile update with Restricted Key Injection
- **Description**: An officer attempts to update their `role` or `uid` field.
- **Payload**:
  ```json
  {
    "role": 0,
    "uid": "new_spoofed_uid"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (only `['name', 'department', 'city', 'ward', 'designation']` are mutable).

### Case 9: Rogue Report creation under Spoofed User ID
- **Description**: User A attempts to create a report under User B's author ID.
- **Payload**:
  ```json
  {
    "userId": "user_B_id",
    "title": "Malicious Grievance Report"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (must match authenticated uid).

### Case 10: Unauthorized Upvote Modification
- **Description**: A citizen attempts to increase the `upvotesCount` of a report by 10 without their UID being added to `upvotesUsers`.
- **Payload**:
  ```json
  {
    "upvotesCount": 15
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (increment must be exactly 1, and request UID must exist in `upvotesUsers`).

### Case 11: Read/Query Leak on Personal Chat Sessions
- **Description**: Attacker tries to list/read chat sessions belonging to a victim.
- **Payload**: `getDoc` or `getDocs` on `chatSessions/victim_session_id`
- **Expectation**: `PERMISSION_DENIED` (resource owner mismatch).

### Case 12: Orphaned Message Writing
- **Description**: Attacker attempts to post a chat message inside a chat session belonging to a different user.
- **Payload**: Write to `chatSessions/victim_session_id/messages/msg_id` with `userId = attacker_id`
- **Expectation**: `PERMISSION_DENIED` (parent chat session userId must match request.auth.uid).
