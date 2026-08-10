# VEIL — API.md

## 1. Purpose

This document defines the API contract between the Veil frontend and backend.

The API must support:

* Authentication
* Room creation
* Member room joining
* Admin room access
* Room information
* Participants
* Chat messages
* Identity reveal/hide
* Moderation
* Reports
* Room management

The backend is authoritative.

The frontend must never assume that a successful UI action means the operation succeeded.

---

# 2. API Architecture

Base URL:

```text id="k7qv21"
/api
```

Example:

```text id="8awh1j"
/api/rooms
/api/auth
/api/messages
```

Production URL should come from environment configuration.

Never hardcode production URLs in frontend code.

---

# 3. Authentication

Authentication should use secure server-managed sessions where practical.

Example:

```text id="8d9c1a"
Browser
 ↓
Login / authentication
 ↓
HTTP-only session cookie
 ↓
Backend
```

The frontend should not send:

```text id="x8k0ez"
userId
role
isAdmin
```

as a trusted security mechanism.

The backend derives the authenticated user from the session.

---

# 4. Standard Response Format

Successful responses should follow a consistent structure.

Example:

```json id="w8m3p4"
{
  "success": true,
  "data": {}
}
```

Error:

```json id="c2k1x8"
{
  "success": false,
  "error": {
    "code": "INVALID_ROOM_CREDENTIALS",
    "message": "Unable to authenticate with the provided credentials."
  }
}
```

Do not expose internal database errors.

---

# 5. HTTP Status Codes

Use standard status codes.

```text id="s9e4q2"
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
```

Use `403` for authenticated users who lack permission.

Use `401` when authentication is missing or invalid.

---

# 6. Authentication Endpoints

## GET /api/auth/me

Returns the currently authenticated user.

### Response

```json id="4q1y3z"
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Dhruv",
      "avatarUrl": null
    }
  }
}
```

Do not return:

```text id="t5n3x8"
password
password_hash
admin_key
room passwords
```

---

# 7. POST /api/auth/logout

Ends the current session.

### Response

```json id="7x3n1p"
{
  "success": true
}
```

The backend must invalidate the session.

---

# 8. CREATE ROOM

## POST /api/rooms

Creates a new Veil room.

Authentication:

**Required**

---

## Request

```json id="h5q8v2"
{
  "name": "Late Night Chaos",
  "description": "What's happening in this room?",
  "password": "room-password",
  "globalAdminKey": "VEIL-key1",
  "maxMembers": 50
}
```

### Important

`globalAdminKey` is **REQUIRED**. It must match one of the global admin keys configured in the backend environment.

The backend will authorize creation based on this key, and then generate a distinct, room-specific `adminKey` which will be returned ONCE in the response for the creator to use.

---

# 9. CREATE ROOM — Backend Processing

Backend must:

```text id="b8r3m1"
1. Authenticate user
2. Validate input
3. Generate unique room code
4. Generate or validate Admin Key
5. Hash room password
6. Hash Admin Key
7. Create room
8. Create owner membership
9. Assign role = admin
10. Generate anonymous identity
11. Create authenticated room session/context
12. Return room information
```

Room creation should use a database transaction.

---

# 10. CREATE ROOM — Response

```json id="p5z8v4"
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "roomCode": "VX7K2P",
      "name": "Late Night Chaos",
      "description": "What's happening in this room?",
      "maxMembers": 50,
      "status": "active"
    },
    "adminKey": "VEIL-8K2X-91Q"
  }
}
```

The plaintext Admin Key should only be returned when it has just been generated.

Do not return it from normal room endpoints.

---

# 11. ADMIN KEY RESPONSE RULE

The Admin Key must never be included in:

```text id="x4c1n8"
GET /api/rooms/:id
GET /api/rooms/:id/members
GET /api/auth/me
WebSocket events
message responses
```

Only the room creation response or explicit secure key-rotation response may contain the newly generated plaintext key.

---

# 12. JOIN ROOM AS MEMBER

## POST /api/rooms/:roomCode/join

Authentication:

**Required**

---

## Request

```json id="m7r2c9"
{
  "password": "room-password"
}
```

The room code comes from the URL.

---

# 13. MEMBER JOIN PROCESS

Backend:

```text id="q4n7w1"
Authenticate
 ↓
Find room
 ↓
Verify room exists
 ↓
Verify room is active
 ↓
Verify room password
 ↓
Check member limit
 ↓
Check whether user already belongs to room
 ↓
Create membership if needed
 ↓
Generate anonymous identity
 ↓
Return authorized room data
```

---

# 14. MEMBER JOIN RESPONSE

```json id="f8x2m5"
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "roomCode": "VX7K2P",
      "name": "Late Night Chaos",
      "description": "What's happening in this room?"
    },
    "membership": {
      "id": "uuid",
      "anonymousName": "Silent Fox",
      "anonymousAvatar": "fox-01",
      "role": "member",
      "identityVisible": false
    }
  }
}
```

Do NOT include:

```text id="n4j7s2"
adminKey
password
other members' hidden real identities
owner credentials
```

---

# 15. JOIN ROOM AS ADMIN

## POST /api/rooms/:roomCode/admin-access

Authentication:

**Required**

---

## Request

```json id="b6p3q1"
{
  "password": "room-password",
  "adminKey": "VEIL-8K2X-91Q"
}
```

---

# 16. ADMIN ACCESS PROCESS

Backend must verify:

```text id="h2k8w4"
Authenticated user
        ↓
Room exists
        ↓
Room is active
        ↓
Room password correct
        ↓
Admin Key correct
        ↓
Authenticated user is room admin
        ↓
Grant admin access
```

All checks must happen server-side.

---

# 17. ADMIN ACCESS RESPONSE

```json id="z9c5v3"
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "roomCode": "VX7K2P",
      "name": "Late Night Chaos",
      "description": "What's happening in this room?"
    },
    "membership": {
      "id": "uuid",
      "anonymousName": "Silent Fox",
      "anonymousAvatar": "fox-01",
      "role": "admin",
      "identityVisible": false
    }
  }
}
```

The Admin Key itself must NOT be returned.

---

# 18. GET ROOM

## GET /api/rooms/:roomCode

Authentication:

**Required**

User must be a member of the room.

Returns only information the requesting user is allowed to see.

Example:

```json id="c8w4n2"
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "roomCode": "VX7K2P",
      "name": "Late Night Chaos",
      "description": "..."
    }
  }
}
```

---

# 19. GET MEMBERS

## GET /api/rooms/:roomCode/members

Authentication:

**Required**

User must belong to the room.

The backend must generate the response according to the viewer's permissions.

---

## Normal Member Response

```json id="r7x2k4"
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "membership-uuid",
        "displayName": "Silent Fox",
        "avatar": "fox-01",
        "identityVisible": false
      }
    ]
  }
}
```

No hidden real identity should be included.

---

# 20. ADMIN MEMBER RESPONSE

For an authorized admin:

```json id="w3q9m5"
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "membership-uuid",
        "displayName": "Silent Fox",
        "realName": "Dhruv",
        "identityVisible": false
      }
    ]
  }
}
```

This endpoint must verify that the requester is an admin.

---

# 21. MESSAGE HISTORY

## GET /api/rooms/:roomCode/messages

Authentication:

**Required**

User must belong to the room.

Query:

```text id="q5v8n2"
?limit=50
&before=<cursor>
```

Recommended maximum:

```text id="r4k1x7"
50 messages per request
```

---

# 22. MESSAGE RESPONSE

Example:

```json id="k8m3q5"
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "bro 😭",
        "displayName": "Silent Fox",
        "identityVisible": false,
        "createdAt": "2026-08-09T12:00:00Z"
      }
    ],
    "nextCursor": "..."
  }
}
```

The backend determines `displayName`.

Do not expose raw `sender_id` unless the frontend genuinely requires it.

---

# 23. REVEAL IDENTITY

## POST /api/rooms/:roomCode/members/:memberId/reveal

Authentication:

**Required**

Authorization:

**Room Admin Only**

Request body:

```json id="f5n8k2"
{}
```

The target member must belong to the same room.

---

# 24. REVEAL PROCESS

Backend:

```text id="m9q3v7"
Authenticate
 ↓
Verify room membership
 ↓
Verify admin role
 ↓
Verify target membership
 ↓
Set identity_visible = true
 ↓
Create moderation record
 ↓
Commit transaction
 ↓
Broadcast identity.revealed
```

---

# 25. REVEAL RESPONSE

```json id="t2w8p4"
{
  "success": true,
  "data": {
    "member": {
      "id": "membership-uuid",
      "displayName": "Dhruv",
      "identityVisible": true
    }
  }
}
```

The exact response may be adjusted depending on frontend requirements.

---

# 26. HIDE IDENTITY

## POST /api/rooms/:roomCode/members/:memberId/hide

Authentication:

**Required**

Authorization:

**Room Admin Only**

Request:

```json id="n4x7c2"
{}
```

Backend:

```text id="v8m1q6"
Verify admin
 ↓
Verify target membership
 ↓
Set identity_visible = false
 ↓
Create moderation record
 ↓
Commit
 ↓
Broadcast identity.hidden
```

---

# 27. MODERATION — MUTE

## POST /api/rooms/:roomCode/members/:memberId/mute

Authentication:

**Required**

Authorization:

**Admin Only**

Request:

```json id="c7q2m8"
{
  "duration": 300
}
```

Duration is seconds.

Backend determines whether the action is allowed.

---

# 28. MODERATION — UNMUTE

## POST /api/rooms/:roomCode/members/:memberId/unmute

Authentication:

**Required**

Authorization:

**Admin Only**

Request:

```json id="j3n8p1"
{}
```

---

# 29. REMOVE MEMBER

## POST /api/rooms/:roomCode/members/:memberId/remove

Authentication:

**Required**

Authorization:

**Admin Only**

Request:

```json id="b5w2k9"
{}
```

The member should be removed from the active room.

The WebSocket connection should be notified.

---

# 30. BAN MEMBER

## POST /api/rooms/:roomCode/members/:memberId/ban

Authentication:

**Required**

Authorization:

**Admin Only**

Request:

```json id="x7m4q2"
{}
```

The backend should mark the membership as banned.

The user should be disconnected from the room if currently connected.

---

# 31. REPORT USER

## POST /api/rooms/:roomCode/reports

Authentication:

**Required**

Request:

```json id="n2v8c4"
{
  "reportedMemberId": "uuid",
  "messageId": "uuid",
  "reason": "harassment"
}
```

The backend verifies:

```text id="y6k1p9"
reporter belongs to room
reported member belongs to room
message belongs to room
```

---

# 32. CLOSE ROOM

## POST /api/rooms/:roomCode/close

Authentication:

**Required**

Authorization:

**Room Admin Only**

Request:

```json id="m8q3x5"
{}
```

Backend changes:

```text id="h2w7n4"
status = closed
```

The room should stop accepting new members.

Connected members should receive:

```text id="r5c1v8"
room.closed
```

---

# 33. UPDATE ROOM

## PATCH /api/rooms/:roomCode

Authentication:

**Required**

Authorization:

**Room Admin Only**

Allowed fields should be explicitly defined.

Example:

```json id="p9x4k2"
{
  "name": "New Room Name",
  "description": "Updated description",
  "maxMembers": 100
}
```

Do not allow clients to update:

```text id="f8n2m5"
owner_id
admin_key_hash
password_hash
role
identity_visible
```

through this endpoint.

---

# 34. CHANGE ROOM PASSWORD

## POST /api/rooms/:roomCode/password

Authentication:

**Required**

Authorization:

**Room Admin Only**

Request:

```json id="q3m7x1"
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

Backend verifies the current password before replacing the hash.

---

# 35. ROTATE ADMIN KEY

Future endpoint:

## POST /api/rooms/:roomCode/admin-key/rotate

Authentication:

**Required**

Authorization:

**Room Admin Only**

Process:

```text id="b8x2m4"
Authenticate
 ↓
Verify admin
 ↓
Generate new key
 ↓
Hash new key
 ↓
Replace old hash
 ↓
Invalidate old key
 ↓
Return new plaintext key once
```

The old key must immediately stop working.

---

# 36. WebSocket Connection

Socket endpoint:

```text id="r5v2m8"
/socket.io
```

Authentication must happen during connection.

The server identifies the authenticated user from the session.

Do not trust:

```json id="q9k3x7"
{
  "userId": "..."
}
```

as the authentication mechanism.

---

# 37. Socket Room Join

Event:

```text id="m4x8p2"
room.join
```

Client may request:

```json id="c7n2v5"
{
  "roomCode": "VX7K2P"
}
```

Server verifies:

```text id="w9q4m1"
authenticated
+
room exists
+
user is member
```

Only then:

```text id="z2k7x5"
socket.join(roomSocketId)
```

---

# 38. SEND MESSAGE

Event:

```text id="f8m3q1"
message.send
```

Client:

```json id="v5n9x2"
{
  "content": "bro 😭"
}
```

The client does NOT send:

```text id="k2q7m4"
senderId
roomId
role
```

The backend derives these from the authenticated socket and room context.

---

# 39. MESSAGE CREATED EVENT

Server broadcasts:

```text id="r3x8n5"
message.created
```

Payload:

```json id="m7q2v9"
{
  "message": {
    "id": "uuid",
    "content": "bro 😭",
    "displayName": "Silent Fox",
    "identityVisible": false,
    "createdAt": "..."
  }
}
```

The payload must be safe for all recipients.

---

# 40. IDENTITY REVEAL EVENT

Event:

```text id="p4x8m2"
identity.revealed
```

Example:

```json id="n7q3v5"
{
  "memberId": "uuid",
  "displayName": "Dhruv",
  "identityVisible": true
}
```

Only broadcast after the database update succeeds.

---

# 41. IDENTITY HIDDEN EVENT

Event:

```text id="x5m9q2"
identity.hidden
```

Example:

```json id="c8v3n7"
{
  "memberId": "uuid",
  "displayName": "Silent Fox",
  "identityVisible": false
}
```

---

# 42. PRESENCE EVENTS

Events:

```text id="j4n8x2"
member.joined
member.left
member.online
member.offline
```

Example:

```json id="v7m2q5"
{
  "memberId": "uuid",
  "displayName": "Silent Fox"
}
```

Do not include unnecessary real identity information.

---

# 43. TYPING EVENTS

Events:

```text id="k5x9m2"
typing.start
typing.stop
```

Payload:

```json id="q8v3n6"
{
  "memberId": "uuid",
  "displayName": "Silent Fox"
}
```

Typing events should not be stored in the database.

---

# 44. WebSocket Moderation Events

Events:

```text id="m3q7x9"
member.muted
member.unmuted
member.removed
member.banned
```

The backend decides which clients receive each event.

---

# 45. Error Handling

HTTP:

```json id="p6x2m8"
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "This room could not be found."
  }
}
```

WebSocket:

```json id="v9m3q1"
{
  "code": "NOT_AUTHORIZED",
  "message": "You are not authorized to perform this action."
}
```

Never expose stack traces to clients.

---

# 46. Authentication Error

For member/admin room access, avoid unnecessarily revealing which credential failed.

Example:

```json id="x5q8n2"
{
  "success": false,
  "error": {
    "code": "INVALID_ROOM_CREDENTIALS",
    "message": "Unable to authenticate with the provided credentials."
  }
}
```

Do not return:

```text id="j4m7v9"
"Admin Key is correct but password is wrong."
```

---

# 47. Validation

All API inputs must be validated server-side.

Validate:

```text id="c8x3m5"
type
length
format
required fields
allowed values
room membership
authorization
```

Recommended validation library:

**Zod**

Use the same schemas where practical for consistent validation.

---

# 48. Rate Limiting

Rate-limit:

```text id="m7q2x8"
POST /api/rooms
POST /api/rooms/:roomCode/join
POST /api/rooms/:roomCode/admin-access
POST /api/rooms/:roomCode/reports
```

Especially:

```text id="n5v8c3"
Admin authentication
```

WebSocket message sending must also be rate limited.

---

# 49. Pagination

Endpoints returning collections must support pagination where necessary.

Especially:

```text id="r2x7m4"
messages
reports
moderation history
members
```

Do not return unlimited database rows.

---

# 50. API Security Rules

Every endpoint must follow:

```text id="k9m3v7"
Authenticate
 ↓
Authorize
 ↓
Validate
 ↓
Execute
 ↓
Filter response
 ↓
Return
```

Not:

```text id="w4x8q2"
Validate
 ↓
Execute
 ↓
Hope frontend handles security
```

---

# 51. API Rules for AI Coding Agents

AI-generated API code must:

* use authenticated sessions
* verify room membership
* verify admin role for admin actions
* validate every request
* use parameterized database queries
* never trust client-provided roles
* never trust client-provided sender IDs
* never expose hidden identities
* never expose Admin Keys
* never expose password hashes
* never return unnecessary sensitive fields

If API implementation conflicts with:

`SECURITY.md`

or

`DATABASE.md`

the security requirements take priority.

---

# 52. MVP API Surface

The initial implementation should prioritize:

```text id="v8q2m5"
GET    /api/auth/me
POST   /api/auth/logout

POST   /api/rooms
GET    /api/rooms/:roomCode
POST   /api/rooms/:roomCode/join
POST   /api/rooms/:roomCode/admin-access

GET    /api/rooms/:roomCode/members
GET    /api/rooms/:roomCode/messages

POST   /api/rooms/:roomCode/members/:memberId/reveal
POST   /api/rooms/:roomCode/members/:memberId/hide

POST   /api/rooms/:roomCode/members/:memberId/mute
POST   /api/rooms/:roomCode/members/:memberId/unmute
POST   /api/rooms/:roomCode/members/:memberId/remove
POST   /api/rooms/:roomCode/members/:memberId/ban

POST   /api/rooms/:roomCode/reports

PATCH  /api/rooms/:roomCode
POST   /api/rooms/:roomCode/close
```

Keep the MVP API small.

---

# 53. Final API Principle

The frontend asks:

> "Can I perform this action?"

The backend decides:

> "Yes or no."

The frontend displays:

> "What the backend allows this user to see."

The most sensitive API rule is:

```text id="q4x8m2"
Never send data to the client
that the client is not authorized to know.
```

For Veil, this is particularly important for:

**real identities, Admin Keys, room credentials and moderation data.**


---
# Additional Endpoints

## POST /api/rooms/:roomCode/close
Closes the room explicitly. Only allowed by room admin.
Transitions room to CLOSED status, prevents new joins, and triggers socket disconnects and data cleanup.

