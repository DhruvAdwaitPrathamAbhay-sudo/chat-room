# VEIL — SECURITY.md

## 1. Purpose

This document defines the security, privacy and authorization rules for Veil.

Veil's core promise is:

> A user's real identity remains hidden from other room members unless the room administrator explicitly reveals it.

Security decisions must prioritize:

1. Identity privacy
2. Authorization
3. Admin key security
4. Room isolation
5. Session security
6. Real-time security
7. Abuse prevention
8. Data integrity

These rules apply to both human developers and AI-generated code.

---

# 2. Core Security Principle

## NEVER TRUST THE CLIENT

The frontend is an untrusted environment.

Anything sent by the frontend can potentially be modified.

Never trust client-provided:

```text
userId
roomId
role
isAdmin
isOwner
identityVisible
realName
anonymousName
permissions
```

The backend must derive and verify these values.

---

# 3. Identity Privacy Model

Veil has two identity layers.

### Real Identity

Stored in the user's account.

Example:

```text
user.id
user.name
user.email
```

### Anonymous Room Identity

Created for the user's membership in a specific room.

Example:

```text
room_member.anonymous_name
room_member.anonymous_avatar
```

The anonymous identity is NOT global.

A user can have different anonymous identities in different rooms.

Example:

```text
User: Dhruv

Room A:
Silent Fox

Room B:
Shadow Wolf
```

---

# 4. Default Identity State

Whenever a user joins a room:

```text
identity_visible = false
```

A user must never become publicly revealed by default.

The only mechanism that can change this state is an authorized admin action.

---

# 5. Identity Visibility States

Each room membership has:

```text
anonymous
revealed
```

Default:

```text
anonymous
```

Admin action:

```text
anonymous → revealed
```

Admin action:

```text
revealed → anonymous
```

These changes must happen on the backend.

The frontend must never directly modify identity visibility.

---

# 6. Identity Data Exposure

## Normal Member

A normal member may receive:

```text
anonymous_name
anonymous_avatar
online_status
membership_status
```

A normal member must NOT receive:

```text
real_name
real_email
real_avatar
user profile details
admin key
```

unless that identity has been explicitly revealed.

---

# 7. Admin Identity Access

A verified room administrator may access the real identities of members in their room.

Example:

```text
Anonymous:
Silent Fox

Real identity:
Dhruv
```

However, admin access must still be limited to the room they administer.

An admin of:

```text
Room A
```

must NOT be able to access identities belonging to:

```text
Room B
```

---

# 8. Backend Identity Filtering

Identity filtering must happen on the backend.

### WRONG

```text
API returns:

{
  realName: "Dhruv",
  anonymousName: "Silent Fox",
  identityVisible: false
}
```

Then frontend hides `realName`.

This is insecure.

### CORRECT

For a normal member:

```json
{
  "displayName": "Silent Fox",
  "identityVisible": false
}
```

For an authorized admin:

```json
{
  "displayName": "Silent Fox",
  "realName": "Dhruv",
  "identityVisible": false
}
```

For everyone after reveal:

```json
{
  "displayName": "Dhruv",
  "identityVisible": true
}
```

The backend determines what information is returned.

---

# 9. Global Admin Keys

A Global Admin Key authorizes a person to **create** a new Veil room.

*   They are configured via backend environment variables (e.g. `ADMIN_KEYS`).
*   They are strictly configuration-level secrets and must NEVER be stored in the database.
*   They must NEVER be logged, returned in API responses, or exposed to frontend JavaScript.
*   The backend validates them using constant-time comparison (`crypto.timingSafeEqual`).
*   A Global Admin Key does NOT grant permanent or automatic admin access to all existing rooms.

After a valid Global Admin Key authorizes room creation, the backend generates a distinct **Room Admin Key** for the creator to use for room administration.

---

# 10. Room Admin Key

The Admin Key establishes administrative access to a specific room.

Example:

```text
Room ID:
VX7K2P

Admin Key:
VEIL-8K2X-91Q
```

The Admin Key belongs only to that room.

An Admin Key must never grant administrative access to another room.

---

# 10. Admin Key Creation

When a room is created:

```text
Generate secure random Admin Key
        ↓
Show plaintext key to creator once
        ↓
Hash key
        ↓
Store hash in database
        ↓
Discard plaintext key
```

Never store the plaintext Admin Key.

Database:

```text
admin_key_hash
```

Never:

```text
admin_key
```

---

# 11. Admin Key Requirements

Admin Keys must have sufficient entropy.

Recommended:

```text
At least 128 bits of cryptographic randomness
```

Use a cryptographically secure random number generator.

Do NOT generate keys using:

```text
Math.random()
Date.now()
username
room name
room ID
predictable strings
```

Use a secure server-side random generator.

---

# 12. Admin Key Verification

When joining as admin:

```text
Room ID
Room Password
Admin Key
```

Backend:

```text
1. Authenticate user
2. Find room
3. Verify room password
4. Verify Admin Key hash
5. Verify user is authorized as room admin
6. Create admin session
```

All checks happen server-side.

---

# 13. Admin Key Never Exposed

The Admin Key must NEVER appear in:

```text
API responses
WebSocket events
database queries returned to client
logs
analytics
error messages
browser localStorage
browser sessionStorage
URL parameters
query strings
```

Never put an Admin Key into:

```text
https://veil.app/admin?key=VEIL-8K2X-91Q
```

URLs can be stored in browser history, logs and analytics.

---

# 14. Admin Key Brute-Force Protection

Admin authentication must be rate limited.

Repeated failures should trigger:

```text
rate limiting
temporary cooldown
progressive delay
```

Do not permanently lock an account after a small number of failures.

The system should resist automated guessing without creating an easy denial-of-service mechanism.

---

# 15. Room Password Security

Room passwords must also be stored as hashes.

Recommended:

```text
Argon2id
```

Database:

```text
password_hash
```

Never:

```text
password
```

Room passwords must not be returned by normal room APIs.

---

# 16. Authentication

All protected room operations require an authenticated user.

Examples:

```text
send message
join socket room
view participants
reveal identity
hide identity
mute user
remove user
ban user
change room settings
```

The backend must verify authentication for every protected operation.

---

# 17. Authorization

Authentication answers:

> Who is this?

Authorization answers:

> What is this user allowed to do?

Every protected action must perform authorization.

Example:

```text
Reveal Identity
      ↓
Is user authenticated?
      ↓
Is user a member of this room?
      ↓
Is user the room admin?
      ↓
Is target member inside this room?
      ↓
Allow action
```

Never authorize based solely on frontend state.

---

# 18. Room Isolation

Every room is an isolated security boundary.

A user with access to:

```text
Room A
```

must not automatically access:

```text
Room B
```

All room-related database queries must scope by:

```text
room_id
```

Example:

```text
SELECT *
FROM room_members
WHERE room_id = ?
AND user_id = ?
```

Do not fetch a user's memberships globally and assume they belong to the requested room.

---

# 19. IDOR Protection

Protect against Insecure Direct Object Reference attacks.

Example attack:

```text
POST /rooms/ROOM_A/members/USER_B/reveal
```

The backend must verify:

```text
requesting user
+
ROOM_A membership
+
ROOM_A admin role
+
USER_B belongs to ROOM_A
```

Never assume that knowing a room ID or member ID grants access.

---

# 20. Message Security

Messages must always be associated with:

```text
authenticated user
+
authorized room
```

Never trust the client to provide the sender.

### WRONG

```json
{
  "senderId": "user123",
  "message": "hello"
}
```

### CORRECT

Backend obtains:

```text
senderId
```

from the authenticated session/socket.

The client only sends:

```json
{
  "message": "hello"
}
```

---

# 21. Message Validation

Every message must be validated server-side.

Validate:

```text
message type
message length
content format
room membership
rate limits
```

Set a reasonable maximum message size.

Reject oversized payloads.

Never assume the frontend validation is sufficient.

---

# 22. XSS Protection

User-generated content must be treated as untrusted.

Messages may contain:

```text
HTML
JavaScript
URLs
special characters
```

The application must prevent execution of arbitrary scripts.

Do not render user messages using unsafe HTML injection unless the content has been properly sanitized.

Prefer rendering messages as plain text.

---

# 23. WebSocket Security

Socket connections must be authenticated.

Connection flow:

```text
Client
 ↓
Socket connection
 ↓
Authentication verification
 ↓
User identity established
 ↓
Room membership verification
 ↓
Socket joins room
```

Never allow:

```text
socket.join(roomId)
```

without backend authorization.

---

# 24. WebSocket Event Authorization

Every sensitive WebSocket event must be authorized.

Examples:

```text
identity.reveal
identity.hide
member.mute
member.remove
member.ban
room.update
```

Do not assume that because a socket joined a room it has admin permissions.

Admin authorization must be checked independently.

---

# 25. Real-Time Identity Events

When an admin reveals a user:

```text
Admin request
 ↓
Backend authorization
 ↓
Database update
 ↓
Broadcast authorized event
```

The event should contain only information appropriate for the recipients.

Do not broadcast hidden identity information before the reveal operation succeeds.

---

# 26. Race Conditions

Identity actions must be handled safely.

Example:

Two admin actions happen almost simultaneously:

```text
Reveal
Hide
```

The backend/database must maintain a consistent final state.

Do not rely solely on frontend state.

Database updates should be atomic where appropriate.

---

# 27. Session Security

Use secure server-managed authentication.

Recommended:

```text
HTTP-only cookies
Secure cookies
SameSite configuration
```

Avoid storing long-lived authentication tokens in:

```text
localStorage
```

if an HTTP-only session approach is practical.

Sessions must be revocable.

---

# 28. Session Authorization

Every request must resolve the authenticated user from the session.

Do not trust:

```text
userId
role
admin
```

sent from the client.

The server determines:

```text
current user
current room membership
current role
current permissions
```

---

# 29. CSRF Protection

If authentication uses cookies, protect state-changing HTTP endpoints against CSRF.

Use an appropriate strategy such as:

```text
SameSite cookies
CSRF tokens where required
Origin checks
```

Do not assume CORS alone is CSRF protection.

---

# 30. CORS

Only trusted frontend origins should be allowed.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated production APIs unless there is a specific justified reason.

Production origins should be explicitly configured.

---

# 31. Rate Limiting

Rate limit:

```text
login
admin authentication
room creation
room joining
message sending
reports
password attempts
```

Especially protect:

```text
Admin Key verification
```

from brute-force attacks.

---

# 32. Abuse Prevention

Because Veil is anonymous, abuse is expected to be a potential problem.

Initial protections:

```text
message rate limits
mute
remove
ban
report
room participant limits
```

Future:

```text
spam detection
automated moderation
IP/device abuse controls
temporary bans
room-level slow mode
```

Do not rely on anonymity as a substitute for moderation.

---

# 33. Admin Protection

Admin credentials must be treated as highly sensitive.

Admin actions should be clearly separated from normal member actions.

Sensitive operations:

```text
reveal identity
ban
remove
change password
change admin settings
close room
```

should require current authenticated admin authorization.

For especially sensitive future actions, consider step-up authentication.

---

# 34. Privilege Escalation Prevention

A normal member must never be able to become admin by modifying:

```text
role
isAdmin
admin
permissions
roomRole
```

in frontend requests.

Example malicious request:

```json
{
  "role": "admin"
}
```

must be ignored/rejected.

Role changes must only occur through authorized backend operations.

---

# 35. Admin Key Rotation

Future feature:

Admin should be able to regenerate their Admin Key.

Workflow:

```text
Current admin authentication
 ↓
Generate new key
 ↓
Invalidate old key
 ↓
Hash new key
 ↓
Store new hash
```

Old key must immediately stop working.

This is not required for the first MVP but the database architecture should allow it.

---

# 36. Room Password Changes

If the admin changes the room password:

```text
New password
 ↓
Hash
 ↓
Replace old password hash
```

Existing authenticated sessions should not automatically be invalidated unless product policy requires it.

New members must use the new password.

---

# 37. Room Deletion

Deleting a room is destructive.

Admin confirmation should be required.

Example:

```text
Delete "Late Night Chaos"?

All messages and memberships associated
with this room may be permanently deleted.

[Cancel] [Delete Room]
```

Backend verifies:

```text
authenticated
+
room admin
```

Do not allow normal members to delete rooms.

---

# 38. Logging

Logs must never contain:

```text
Admin Keys
Room passwords
authentication tokens
session cookies
real identities unnecessarily
private messages unnecessarily
```

Safe logs:

```text
room_created
room_joined
admin_authentication_failed
identity_revealed
identity_hidden
member_removed
```

Prefer IDs over sensitive personal data.

---

# 39. Error Messages

Errors should be useful without leaking sensitive information.

Avoid:

```text
Admin key correct but password incorrect.
```

when this distinction could help attackers.

Prefer:

```text
Unable to authenticate admin access.
Check your credentials and try again.
```

Detailed security information should stay server-side.

---

# 40. Database Security

Production database credentials must never be committed to Git.

Use environment variables/secrets management.

Example:

```text
DATABASE_URL
SESSION_SECRET
AUTH_SECRET
```

Use least-privilege database credentials.

Do not let the frontend connect directly to the production database.

---

# 41. Environment Variables

Never commit:

```text
.env
```

to Git.

Commit:

```text
.env.example
```

with placeholders.

Example:

```text
DATABASE_URL=
SESSION_SECRET=
AUTH_SECRET=
FRONTEND_URL=
```

Never put real secrets into source code.

---

# 42. Dependency Security

Keep dependencies updated.

Before production:

```text
npm audit
```

or equivalent security scanning.

Avoid unnecessary dependencies.

Every dependency increases the attack surface.

---

# 43. Security Headers

Production HTTP responses should use appropriate security headers.

Examples:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
```

Configure them according to the actual deployment environment.

---

# 44. HTTPS

Production traffic must use HTTPS.

This includes:

```text
frontend
API
WebSocket
authentication
room access
```

Never transmit credentials over plain HTTP in production.

WebSockets should use:

```text
WSS
```

instead of insecure:

```text
WS
```

---

# 45. Data Minimization

Do not collect information that Veil does not need.

For the MVP, minimize storage of:

```text
personal information
device information
location
tracking data
```

Store only what is necessary for the product.

---

# 46. Privacy by Design

Anonymity should be implemented at the data/API level, not only the visual level.

Every feature must answer:

> Could this feature accidentally reveal a user's real identity?

Before shipping any feature, check:

```text
API response
WebSocket events
database queries
logs
notifications
browser state
URLs
analytics
error messages
```

---

# 47. Frontend Security Rules

Frontend code must never:

* contain database credentials
* contain Admin Key secrets
* determine admin permissions
* expose hidden identities
* perform security-critical authorization
* assume API responses are trusted
* store sensitive secrets unnecessarily

Frontend is responsible for presentation.

Backend is responsible for security.

---

# 48. AI Coding Rules

AI-generated code must follow this document.

AI agents must NOT:

* invent security shortcuts
* move authorization into frontend
* store plaintext passwords
* store plaintext Admin Keys
* expose real identities to all clients
* bypass backend validation
* disable CORS/security controls for convenience
* use insecure random generators
* add secrets to source code

If generated code conflicts with this document:

**SECURITY.md takes priority.**

---

# 49. Security Checklist Before Production

## Authentication

* [ ] Authentication implemented
* [ ] Secure session handling
* [ ] HTTP-only cookies where applicable
* [ ] Session expiration
* [ ] Session revocation

## Authorization

* [ ] Every protected endpoint checks authorization
* [ ] Every sensitive WebSocket event checks authorization
* [ ] Admin role verified server-side
* [ ] Room membership verified server-side
* [ ] IDOR protection implemented

## Identity Privacy

* [ ] Hidden identities never sent to normal members
* [ ] Identity filtering happens server-side
* [ ] Reveal requires admin authorization
* [ ] Hide requires admin authorization
* [ ] Identity state is stored server-side
* [ ] No identity leakage through WebSockets

## Admin Key

* [ ] Unique per room
* [ ] Cryptographically random
* [ ] Hashed before database storage
* [ ] Never logged
* [ ] Never placed in URLs
* [ ] Rate limited
* [ ] Verified server-side

## Passwords

* [ ] Room passwords hashed
* [ ] User passwords/authentication handled securely
* [ ] No plaintext credentials
* [ ] Rate limiting implemented

## API

* [ ] Input validation
* [ ] Output filtering
* [ ] Rate limiting
* [ ] CORS configured
* [ ] CSRF strategy implemented
* [ ] Error responses don't leak sensitive information

## WebSockets

* [ ] Socket authentication
* [ ] Room membership verification
* [ ] Event authorization
* [ ] Reconnection handling
* [ ] No sensitive broadcast leakage

## Infrastructure

* [ ] HTTPS
* [ ] WSS
* [ ] Secrets stored securely
* [ ] `.env` excluded from Git
* [ ] Security headers
* [ ] Database backups
* [ ] Monitoring
* [ ] Error tracking

---

# 50. Final Security Principle

Veil's most important security promise is:

> **A user's anonymity must be enforced by the server, not by the interface.**

The frontend can make someone *look* anonymous.

Only the backend can make them **actually anonymous**.

Therefore:

```text
Frontend
   ↓
Requests

Backend
   ↓
Authentication
   ↓
Authorization
   ↓
Privacy filtering
   ↓
Database
   ↓
Real-time events
   ↓
Authorized clients only
```

If there is ever a conflict between:

```text
UX convenience
```

and

```text
identity privacy
```

**identity privacy wins.**


---
# Additional Security Rules
- **Anonymous Identity Uniqueness**: The server must generate unique anonymous identities per room. Real identity must never be leaked during generation.
- **Admin Close Room**: Only the authenticated room admin can close the room. Never trust a frontend `isAdmin` or `role` value.

