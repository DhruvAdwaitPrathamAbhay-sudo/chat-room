# VEIL — TESTING.md

## 1. Purpose

This document defines the testing strategy for Veil.

Testing must verify:

* Functional correctness
* Security
* Authorization
* Anonymous identity behavior
* Real-time synchronization
* Database integrity
* Frontend behavior
* Admin controls
* Error handling
* Reconnection behavior
* Production readiness

The most important principle is:

> **Never trust the frontend.**

A test is not considered complete merely because the UI behaves correctly.

The backend must also reject unauthorized requests.

---

# 2. Testing Philosophy

Veil should be tested at multiple levels:

```text
Unit Tests
    ↓
Integration Tests
    ↓
API Tests
    ↓
WebSocket Tests
    ↓
Security Tests
    ↓
End-to-End Tests
    ↓
Production Smoke Tests
```

---

# 3. Testing Priorities

Priority order:

```text
P0 — Security / authorization
P1 — Core room functionality
P1 — Anonymous identity
P1 — Real-time communication
P2 — Admin moderation
P2 — Error handling
P2 — UI/UX
P3 — Performance
```

A P0 security failure must block production deployment.

---

# 4. Test Environments

Maintain:

```text
Local
Test
Production
```

Do not run destructive tests against the production database.

Production testing should only use controlled test rooms.

---

# 5. Test Data

Create dedicated test rooms.

Example:

```text
Room:
TEST-ROOM

Password:
test-password

Admin:
Test Admin

Members:
Anonymous Fox
Silent Wolf
Blue Ghost
```

Never use real user data for automated tests.

---

# 6. Unit Testing

Unit tests should cover isolated business logic.

Examples:

```text
Room validation
Password validation
Admin permission checks
Identity state transitions
Message validation
Rate-limit logic
Room status logic
Moderation rules
```

---

# 7. Identity State Unit Tests

Identity state is critical.

Expected state:

```text
anonymous
```

Admin action:

```text
anonymous
    ↓
revealed
```

Admin reverse action:

```text
revealed
    ↓
anonymous
```

Tests:

```text
[PASS] Anonymous user initially remains anonymous
[PASS] Authorized admin can reveal
[PASS] Authorized admin can hide
[PASS] Normal member cannot reveal
[PASS] Normal member cannot hide
[PASS] Unauthorized request cannot modify state
```

---

# 8. Identity State Invariants

The following must always remain true:

### Invariant 1

A normal member cannot change another member's identity visibility.

### Invariant 2

A client cannot reveal identity by modifying frontend state.

### Invariant 3

Identity visibility must be determined by server state.

### Invariant 4

A reconnecting client must receive the correct current identity state.

### Invariant 5

Hiding an identity must actually restore the anonymous presentation.

---

# 9. Room Creation Tests

Test:

```text
Valid room creation
Missing room name
Invalid room name
Missing password
Invalid password
Invalid member limit
Duplicate room code
Admin key generation
```

Expected:

```text
Valid request
    ↓
Room created
    ↓
Unique room ID
    ↓
Admin credentials generated
```

---

# 10. Admin Key Tests

Admin Key is security-sensitive.

Test:

```text
Valid Admin Key
Invalid Admin Key
Empty Admin Key
Expired/invalid session
Wrong room + correct Admin Key
Correct room + wrong Admin Key
```

Expected:

```text
Correct credentials
    → Admin access

Incorrect credentials
    → Access denied
```

Never reveal the correct Admin Key in an error message.

Bad:

```text
"Wrong key. The correct key is VEIL-1234."
```

Correct:

```text
"Invalid admin credentials."
```

---

# 11. Room Join Tests

Test member joining:

```text
Valid room
Valid password
Invalid room
Invalid password
Closed room
Full room
Banned user
Rate-limited user
```

Expected behavior must be deterministic.

---

# 12. Room Isolation Tests

This is critical.

Create:

```text
Room A
Room B
```

Member A belongs to Room A.

Member B belongs to Room B.

Test that:

```text
Member A cannot:
read Room B messages
send to Room B
see Room B participants
modify Room B state
```

The same applies to admin operations.

---

# 13. Message Tests

Test:

```text
Send message
Receive message
Message persistence
Message ordering
Empty message
Very long message
Whitespace-only message
Special characters
Unicode
Emoji
Rapid messages
```

Example:

```text
"hello"
"😭"
"こんにちは"
"مرحبا"
"<>"
```

---

# 14. Message Security Tests

Messages are untrusted user input.

Test:

```text
HTML
JavaScript
script tags
malicious URLs
very long strings
special characters
```

Example payload:

```text
<script>alert("xss")</script>
```

Expected:

```text
Displayed as text
```

It must never execute as JavaScript.

---

# 15. XSS Test

Attempt:

```text
<script>
  fetch("malicious-site")
</script>
```

Expected:

```text
No script execution
```

Test both:

```text
message content
room name
room description
anonymous display name
```

---

# 16. API Authorization Tests

Every protected endpoint must be tested without authorization.

Example:

```text
POST /rooms/:id/reveal
```

Test:

```text
No session
Invalid session
Normal member
Admin from another room
Correct admin
```

Expected:

```text
No session
→ 401/403

Invalid session
→ 401/403

Normal member
→ 403

Admin from another room
→ 403

Correct admin
→ Success
```

---

# 17. Never Test Only the UI

This test is mandatory.

Scenario:

```text
Normal member opens browser
↓
Removes/edits admin button
↓
Calls admin API manually
```

Expected:

```text
Server rejects request
```

The backend must remain secure even when the entire frontend is modified.

---

# 18. WebSocket Authentication Tests

Test Socket.IO connections:

```text
Valid session
Invalid session
Expired session
Missing session
Wrong room
```

Unauthorized socket clients must not receive private room events.

---

# 19. WebSocket Room Isolation

Create:

```text
Room A
Room B
```

Connect:

```text
Client A → Room A
Client B → Room B
```

Send message in Room A.

Expected:

```text
Client A receives message
Client B does NOT receive message
```

---

# 20. Real-Time Message Tests

Test:

```text
Client A sends message
        ↓
Server
        ↓
Database
        ↓
Socket event
        ↓
Client B receives message
```

Verify:

```text
Message content
Sender representation
Timestamp
Ordering
Room membership
```

---

# 21. Identity Reveal Real-Time Test

Scenario:

```text
Admin
Member A
Member B
```

Member A is anonymous.

Admin reveals Member A.

Expected:

```text
Member A → sees updated identity
Member B → sees updated identity if authorized by room policy
Admin → sees updated identity
```

No unauthorized client should receive hidden identity information.

---

# 22. Identity Hide Real-Time Test

Scenario:

```text
Anonymous
    ↓
Revealed
    ↓
Hidden again
```

Verify all connected clients receive the correct new state.

Reconnect a client afterward.

The reconnecting client must receive:

```text
Current state = anonymous
```

not the stale revealed state.

---

# 23. Identity Privacy Test

This is one of the most important tests.

A normal member must NOT be able to obtain another member's real identity through:

```text
API response
Socket event
Database response
Frontend state
Browser network response
HTML
JavaScript variables
```

when that identity is supposed to remain hidden.

---

# 24. Database Privacy Test

Check API/database responses.

If a member is anonymous, do not send unnecessary private identity information to the client.

Bad:

```json
{
  "displayName": "Anonymous Fox",
  "realName": "Dhruv",
  "identityVisible": false
}
```

Better:

```json
{
  "displayName": "Anonymous Fox",
  "identityVisible": false
}
```

The hidden identity should remain server-side unless the requester is authorized to see it.

---

# 25. Admin Authorization Tests

Test every admin action:

```text
Reveal identity
Hide identity
Mute
Unmute
Remove
Ban
Room settings
Close room
```

For each:

```text
No authentication
Normal member
Admin from another room
Correct admin
```

Only the correct admin should succeed.

---

# 26. Admin From Another Room

Critical test:

```text
Admin A → Room A
Admin B → Room B
```

Admin A attempts to modify Room B.

Expected:

```text
Access denied
```

Being an admin somewhere else must not grant global admin privileges.

---

# 27. Ban Tests

Test:

```text
Admin bans member
Member is disconnected
Member attempts to rejoin
Member is rejected
```

Also test:

```text
Banned member cannot create a new session
Banned member cannot reconnect using an old session
```

---

# 28. Remove Tests

Difference between remove and ban must be tested.

### Remove

User is removed from the current room.

### Ban

User is prevented from rejoining.

Verify the implementation follows this distinction.

---

# 29. Mute Tests

Test:

```text
Admin mutes member
Member sends message
Server rejects message
Admin unmutes member
Member sends message
Message succeeds
```

The server must enforce mute status.

A modified frontend must not bypass mute.

---

# 30. Room Closure Tests

When admin closes a room:

```text
New members cannot join
Existing members receive notification
Active connections are handled correctly
Messages cannot be sent if room policy forbids it
```

Rejoining a closed room must fail.

---

# 31. Rate-Limit Tests

Rate limits should be tested for:

```text
Login/join attempts
Admin authentication
Message sending
Room creation
Identity actions
Reports
```

Test:

```text
Normal usage
Rapid repeated requests
Automated repeated requests
```

Expected:

```text
Normal request → allowed

Excessive request → rate limited
```

---

# 32. Brute-Force Admin Key Test

Attempt many incorrect Admin Keys.

Expected:

```text
Repeated failures
        ↓
Rate limiting
        ↓
Further attempts delayed/rejected
```

Do not allow unlimited Admin Key guessing.

---

# 33. Brute-Force Room Password Test

Same principle applies to room passwords.

Repeated incorrect attempts must trigger rate limiting.

---

# 34. Input Validation Tests

Test every user-controlled field:

```text
Room name
Description
Password
Admin Key
Message
Display name
Room code
```

Test:

```text
empty
too short
too long
special characters
Unicode
whitespace
unexpected types
null
arrays
objects
```

Server-side validation is mandatory.

---

# 35. Type Confusion Tests

Attempt requests such as:

```json
{
  "roomId": [],
  "password": {},
  "memberId": true
}
```

Expected:

```text
Validation error
```

Never allow malformed input to reach business logic unchecked.

---

# 36. Session Tests

Test:

```text
Valid session
Expired session
Invalid session
Revoked session
Missing session
Session from another environment
```

Verify protected resources remain protected.

---

# 37. Session Fixation Tests

Ensure a session cannot be reused incorrectly after authentication or privilege changes.

When authentication state changes:

```text
old session
    ↓
invalidated/replaced as appropriate
    ↓
new authenticated session
```

---

# 38. Reconnection Tests

Scenario:

```text
User joins room
↓
Connection lost
↓
Network restored
↓
Socket reconnects
```

Verify:

```text
User remains correctly authenticated
Room membership is correct
Messages synchronize
Identity state is correct
Mute state is correct
Ban state is enforced
```

---

# 39. Duplicate Connection Tests

Open the same account/session from multiple browser tabs.

Test:

```text
Tab A
Tab B
```

Verify the system handles multiple connections consistently.

Do not accidentally create duplicate membership records.

---

# 40. Browser Refresh Tests

Test refreshing:

```text
Landing
Join page
Room
Admin room
```

Refreshing the room should not unexpectedly expose private information.

The user should either:

```text
remain authenticated
```

or:

```text
be safely redirected to authentication
```

depending on the session architecture.

---

# 41. Back Button Tests

Test:

```text
Join room
→ Room
→ Back
→ Forward
```

Ensure users cannot access protected information merely through browser history after authorization is revoked.

---

# 42. Logout Tests

If logout exists:

```text
Logout
↓
Session invalidated
↓
Protected API rejected
↓
Socket disconnected
```

Refreshing the protected page must not restore access through an invalid session.

---

# 43. Frontend Tests

Test important UI states:

```text
Loading
Success
Error
Disabled
Empty
Reconnect
Modal
Drawer
Toast
```

---

# 44. Form Tests

Member join:

```text
Room ID
Password
```

Admin join:

```text
Room ID
Password
Admin Key
```

Create room:

```text
Room name
Password
Member limit
```

Verify:

```text
Required validation
Invalid input
Submitting state
Success
Failure
```

---

# 45. Responsive Tests

Test:

```text
Mobile
Tablet
Desktop
```

At minimum verify:

```text
Landing
Join
Create
Room
Admin room
```

No critical control should become inaccessible.

---

# 46. Accessibility Tests

Check:

```text
Keyboard navigation
Focus states
Button labels
Input labels
Modal focus
Escape behavior
Color contrast
Screen reader semantics
Reduced motion
```

---

# 47. Visual Regression

Once the Stitch design is finalized, important screens should be checked against the approved design.

Priority screens:

```text
Landing
Join member
Join admin
Create room
Member room
Admin room
```

The purpose is not pixel perfection.

The purpose is preventing accidental UI drift.

---

# 48. Performance Tests

Initial performance testing should focus on:

```text
Room load time
Message rendering
Socket connection time
Database query speed
API response time
```

Test with:

```text
10 users
25 users
50 users
100 users
```

if practical.

Do not assume free infrastructure can support unlimited concurrent users.

---

# 49. Message Load Test

Simulate multiple members sending messages.

Measure:

```text
Message latency
Server CPU
Memory
Database load
Socket stability
Dropped messages
Duplicate messages
```

---

# 50. Concurrent Identity Test

Simulate:

```text
Admin reveals Member A
Admin hides Member B
Multiple members send messages
```

simultaneously.

Verify database consistency and event ordering.

---

# 51. Race Condition Tests

Test simultaneous operations.

Example:

```text
Admin clicks Reveal
Admin clicks Hide immediately
```

or:

```text
Admin removes member
Member sends message simultaneously
```

The backend must resolve state consistently.

---

# 52. Database Integrity Tests

Verify constraints prevent:

```text
duplicate membership
duplicate room codes
invalid room references
invalid member references
orphaned records
```

Use database constraints wherever possible.

---

# 53. Transaction Tests

Operations involving multiple database changes should be tested for partial failure.

Example:

```text
Ban member
+
Update membership
+
Record moderation action
```

If one operation fails, the database should not be left in an inconsistent state.

---

# 54. Error Recovery Tests

Simulate:

```text
Database unavailable
Socket unavailable
API unavailable
Network interruption
Expired session
Invalid room
Closed room
```

The frontend should display useful feedback without exposing internal implementation details.

---

# 55. Production Smoke Test

After every production deployment:

```text
[ ] Landing loads
[ ] Create room works
[ ] Member join works
[ ] Admin join works
[ ] Chat works
[ ] Messages persist
[ ] Real-time messages work
[ ] Anonymous identity works
[ ] Reveal works
[ ] Hide works
[ ] Mute works
[ ] Remove works
[ ] Ban works
[ ] Reconnection works
[ ] Database works
```

---

# 56. Security Regression Suite

Every future backend change must rerun:

```text
Admin authorization
Room isolation
Identity privacy
Admin Key protection
Session validation
Message authorization
Mute enforcement
Ban enforcement
Rate limiting
XSS protection
```

A feature is not complete if it breaks an existing security guarantee.

---

# 57. Test Naming

Use descriptive names.

Good:

```text
adminCannotRevealIdentityOfAnotherRoomMember()
```

Bad:

```text
test1()
```

Tests should explain the expected behavior.

---

# 58. CI Testing

Eventually, every pull request should run:

```text
Install
↓
Lint
↓
Type check
↓
Unit tests
↓
Integration tests
↓
Build
```

Security-critical tests must run before production deployment.

---

# 59. Deployment Gate

Production deployment must be blocked if:

```text
Type check fails
Build fails
Critical tests fail
Security tests fail
Database migration fails
```

Warnings should not automatically block deployment unless explicitly configured as critical.

---

# 60. Critical Security Rule

The following scenario must ALWAYS fail:

```text
Normal member
    ↓
Manipulates frontend
    ↓
Calls admin API directly
    ↓
Attempts identity reveal
```

Expected:

```text
SERVER DENIES REQUEST
```

The same principle applies to:

```text
Mute
Unmute
Remove
Ban
Room settings
Room closure
```

---

# 61. Definition of Done

A Veil feature is considered complete only when:

```text
[ ] UI works
[ ] API works
[ ] Database behavior works
[ ] Real-time behavior works if applicable
[ ] Authorization is enforced server-side
[ ] Invalid input is rejected
[ ] Error state exists
[ ] Loading state exists
[ ] Mobile behavior works
[ ] Security tests pass
[ ] No sensitive data is unnecessarily exposed
```

---

# 62. Final Testing Principle

Veil is not production-ready because:

> "The UI works."

It is production-ready when:

```text
UI works
      +
Backend works
      +
Database is consistent
      +
Real-time system works
      +
Security cannot be bypassed
      +
Failures are handled
      +
Deployment is repeatable
```

The most important test question is always:

> **"What happens if a malicious user does something the UI never intended to allow?"**

If the server still protects the room, the architecture is working correctly.


---
# Additional Testing Requirements
- **Automatic Room Deletion**: Verify that when the last member leaves (and after a brief reconnect timeout), the room is deleted from the database.
- **Anonymous Title Uniqueness**: Verify that members in the same room get unique titles, and titles reset when joining a new room.
- **Admin Close Room**: Verify that only the admin can trigger closure, that the room becomes CLOSED, new joins are rejected, and connected users receive the `room.closed` event.

