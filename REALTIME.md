# VEIL — REALTIME.md

## 1. Purpose

This document defines Veil's real-time communication system.

Veil uses **Socket.IO** for:

* Real-time chat
* Room presence
* Typing indicators
* Identity reveal/hide
* Moderation events
* Room state changes
* Connection/reconnection handling

REST APIs remain responsible for persistent operations and initial data loading.

---

# 2. Real-Time Architecture

```text
                    FRONTEND
                       │
                       │ Socket.IO
                       ▼
              ┌─────────────────┐
              │   Socket Server │
              │    Socket.IO    │
              └────────┬────────┘
                       │
              Authentication
                       │
                 Authorization
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
          Services          PostgreSQL
              │
              ▼
        Room Socket Channel
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
     User   User   Admin
```

The backend controls every socket connection.

---

# 3. Core Principle

A WebSocket connection is **not automatically authorized to access every room**.

The server must verify:

```text
Authenticated user
+
Room membership
+
Room permissions
```

before allowing the socket to join a room.

---

# 4. Socket Connection

Client connects to:

```text
/socket.io
```

Authentication should be derived from the existing authenticated session.

Preferred:

```text
Browser
 ↓
HTTP-only session cookie
 ↓
Socket.IO handshake
 ↓
Backend session verification
```

Do not use a client-controlled:

```text
userId
role
isAdmin
```

as proof of identity.

---

# 5. Connection Lifecycle

```text
CONNECTING
    ↓
AUTHENTICATING
    ↓
AUTHORIZED
    ↓
CONNECTED
    ↓
DISCONNECTING
    ↓
DISCONNECTED
```

If authentication fails:

```text
CONNECTING
    ↓
AUTHENTICATION FAILED
    ↓
DISCONNECTED
```

---

# 6. Connection Event

Server may emit:

```text
connection.ready
```

Payload:

```json
{
  "connectionId": "socket-id",
  "serverTime": "2026-08-09T12:00:00Z"
}
```

Do not include sensitive information.

---

# 7. Joining a Room

After connecting, the client requests:

```text
room.join
```

Payload:

```json
{
  "roomCode": "VX7K2P"
}
```

The server performs:

```text
Authenticate
    ↓
Find room
    ↓
Check room status
    ↓
Find membership
    ↓
Check membership status
    ↓
Authorize
    ↓
socket.join(roomSocketId)
```

Only after all checks succeed should the user join the Socket.IO room.

---

# 8. Internal Socket Room ID

Do not necessarily use the public room code directly as the internal socket room name.

Example:

```text
Public:
VX7K2P

Internal:
room:550e8400-e29b-41d4-a716-446655440000
```

This reduces accidental information exposure and keeps the internal architecture independent from the public identifier.

---

# 9. Room Join Success

Server emits:

```text
room.joined
```

Example:

```json
{
  "roomCode": "VX7K2P",
  "membership": {
    "id": "membership-id",
    "displayName": "Silent Fox",
    "role": "member"
  }
}
```

Do not return:

```text
room password
Admin Key
password hash
admin key hash
hidden real identities
```

---

# 10. Room Join Failure

Example:

```text
room.join.failed
```

Payload:

```json
{
  "code": "NOT_A_MEMBER",
  "message": "You are not authorized to join this room."
}
```

Possible codes:

```text
ROOM_NOT_FOUND
ROOM_CLOSED
NOT_A_MEMBER
MEMBERSHIP_BANNED
UNAUTHORIZED
```

---

# 11. Room Presence

When a member joins successfully:

```text
member.joined
```

is broadcast to authorized room members.

Payload:

```json
{
  "member": {
    "id": "membership-id",
    "displayName": "Silent Fox",
    "avatar": "fox-01"
  }
}
```

The display identity must be generated according to the viewer's permissions.

---

# 12. Leaving a Room

Client:

```text
room.leave
```

Server:

```text
socket.leave(roomSocketId)
```

Then broadcast:

```text
member.left
```

to remaining members.

---

# 13. Disconnect Handling

A disconnect can happen because of:

* Internet failure
* Browser close
* Tab suspension
* Server restart
* Network switch
* Mobile connection change

Do not immediately assume a user permanently left the room.

Socket presence should account for temporary disconnects.

---

# 14. Presence Model

Recommended states:

```text
online
away
offline
```

For MVP, only:

```text
online
offline
```

is necessary.

Presence is ephemeral and should not be stored permanently unless required.

---

# 15. Presence Timing

A user should be considered offline after the socket disconnects or after a configured heartbeat timeout.

Socket.IO handles connection health through heartbeat mechanisms.

Do not implement unnecessary custom heartbeat logic unless needed.

---

# 16. Reconnection

Socket.IO client should use automatic reconnection.

Example behavior:

```text
Connection lost
      ↓
Attempt reconnect
      ↓
Success
      ↓
Authenticate again
      ↓
Rejoin authorized rooms
      ↓
Synchronize missed state
```

---

# 17. Reconnection Security

A reconnect must NOT automatically grant access based solely on previous client state.

The server must revalidate:

```text
Session
Room membership
Membership status
Room status
```

before allowing the socket back into the room.

---

# 18. Reconnection State Sync

After reconnecting, the client should not blindly assume that its previous state is still correct.

Recommended:

```text
Reconnect
 ↓
Re-authenticate
 ↓
Rejoin room
 ↓
Fetch current room state
 ↓
Fetch messages missed during disconnect
 ↓
Resume real-time events
```

REST APIs can be used for synchronization.

---

# 19. Message Sending

Client emits:

```text
message.send
```

Payload:

```json
{
  "content": "bro 😭"
}
```

The client must NOT send:

```json
{
  "senderId": "...",
  "roomId": "...",
  "role": "admin"
}
```

These values come from the authenticated socket context.

---

# 20. Message Processing

Server:

```text
message.send
      ↓
Authenticate socket
      ↓
Find active room context
      ↓
Verify membership
      ↓
Check membership status
      ↓
Check mute status
      ↓
Validate content
      ↓
Apply rate limit
      ↓
Save message
      ↓
Create viewer-safe representation
      ↓
Broadcast
```

---

# 21. Message Validation

Recommended limits:

```text
Minimum:
1 character

Maximum:
2000 characters
```

Reject:

```text
empty messages
invalid payloads
oversized messages
malformed data
```

Trim unnecessary whitespace.

---

# 22. Message Rate Limiting

Messages should be rate limited.

Example starting policy:

```text
10 messages / 5 seconds
```

This is only an initial configuration and should be adjusted based on real usage.

When rate limited:

```text
message.rejected
```

Payload:

```json
{
  "code": "RATE_LIMITED",
  "message": "You're sending messages too quickly."
}
```

---

# 23. Message Persistence

Messages must be persisted before being treated as successfully sent.

Correct:

```text
Client
 ↓
Server
 ↓
Validate
 ↓
Database
 ↓
Success
 ↓
Broadcast
```

Avoid:

```text
Client
 ↓
Broadcast immediately
 ↓
Try saving later
```

The second approach can create inconsistent chat history.

---

# 24. Message Created Event

After successful persistence:

```text
message.created
```

Payload:

```json
{
  "message": {
    "id": "message-id",
    "content": "bro 😭",
    "displayName": "Silent Fox",
    "identityVisible": false,
    "createdAt": "2026-08-09T12:00:00Z"
  }
}
```

---

# 25. Message Identity Resolution

A message contains:

```text
sender_id
```

internally.

The real identity shown to a client depends on:

```text
sender
+
room membership
+
identity_visible
+
viewer permissions
```

The backend must generate the final display representation.

---

# 26. Identity Reveal

Admin emits:

```text
identity.reveal
```

Payload:

```json
{
  "memberId": "membership-id"
}
```

The server must verify:

```text
authenticated
+
room admin
+
target belongs to room
```

before executing the action.

---

# 27. Identity Reveal Processing

```text
identity.reveal
       ↓
Authenticate
       ↓
Authorize admin
       ↓
Verify target
       ↓
BEGIN TRANSACTION
       ↓
identity_visible = true
       ↓
Create moderation record
       ↓
COMMIT
       ↓
Broadcast identity.revealed
```

Never broadcast before the transaction succeeds.

---

# 28. Identity Revealed Event

```text
identity.revealed
```

Example:

```json
{
  "memberId": "membership-id",
  "displayName": "Dhruv",
  "identityVisible": true
}
```

---

# 29. Identity Hide

Admin emits:

```text
identity.hide
```

Payload:

```json
{
  "memberId": "membership-id"
}
```

Processing:

```text
Authenticate
 ↓
Authorize admin
 ↓
Verify target
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

# 30. Identity Hidden Event

```text
identity.hidden
```

Example:

```json
{
  "memberId": "membership-id",
  "displayName": "Silent Fox",
  "identityVisible": false
}
```

---

# 31. Important Identity Rule

Identity visibility is **server state**.

The frontend must never be able to permanently change:

```text
identityVisible
```

by modifying React state.

Example:

```text
Wrong:

setIdentityVisible(true)
```

as the actual security mechanism.

Correct:

```text
Admin action
 ↓
Backend
 ↓
Database
 ↓
Socket event
 ↓
Frontend state update
```

---

# 32. Identity Changes and Existing Messages

When an identity is revealed:

```text
identity.revealed
```

the frontend should update relevant visible messages from that member.

Example:

Before:

```text
Silent Fox:
"bro 😂"
```

After:

```text
Dhruv:
"bro 😂"
```

The backend remains the source of truth.

---

# 33. Identity Hidden Again

If the admin hides the identity:

```text
identity.hidden
```

the frontend must revert:

```text
Dhruv
```

to:

```text
Silent Fox
```

for viewers who should see the anonymous state.

---

# 34. Typing Indicators

Client:

```text
typing.start
typing.stop
```

Payload:

```json
{}
```

The server derives the member identity.

Typing events should not be stored in PostgreSQL.

---

# 35. Typing Rate Limiting

Typing events should be throttled/debounced client-side.

Recommended:

```text
typing.start
```

only when typing begins.

Then:

```text
typing.stop
```

after a short inactivity period.

Do not emit typing events on every keystroke.

---

# 36. Typing Broadcast

Server broadcasts:

```text
typing.started
typing.stopped
```

Example:

```json
{
  "memberId": "membership-id",
  "displayName": "Silent Fox"
}
```

---

# 37. Moderation — Mute

Admin action:

```text
member.mute
```

Payload:

```json
{
  "memberId": "membership-id",
  "duration": 300
}
```

Server:

```text
Verify admin
 ↓
Verify target
 ↓
Update membership
 ↓
Create moderation record
 ↓
Broadcast
```

---

# 38. Muted User

When muted:

```text
member.muted
```

The target user should immediately know they cannot send messages.

The server must enforce the mute.

Frontend disabling the chat box is NOT sufficient.

---

# 39. Moderation — Remove

Admin:

```text
member.remove
```

Server:

```text
Verify admin
 ↓
Update membership
 ↓
Create moderation record
 ↓
Notify target
 ↓
Disconnect/remove socket from room
 ↓
Broadcast member.removed
```

---

# 40. Moderation — Ban

Admin:

```text
member.ban
```

Server:

```text
Verify admin
 ↓
Mark membership banned
 ↓
Create moderation record
 ↓
Notify target
 ↓
Remove socket
 ↓
Prevent future room joins
```

---

# 41. Room Closed Event

Admin closes the room.

Server broadcasts:

```text
room.closed
```

Payload:

```json
{
  "roomCode": "VX7K2P"
}
```

Clients should transition to an appropriate closed-room state.

---

# 42. Event Authorization

Every event that changes state must have server-side authorization.

Examples:

```text
message.send
identity.reveal
identity.hide
member.mute
member.unmute
member.remove
member.ban
room.close
```

Never assume:

```text
"the UI only shows the admin button"
```

is security.

A malicious client can manually emit any event.

---

# 43. Event Ownership

The server determines:

```text
Who sent the event?
Which room?
Which membership?
Which role?
```

Never trust these values from the payload.

---

# 44. Event Names

Use consistent naming.

### Client → Server

```text
room.join
room.leave

message.send

typing.start
typing.stop

identity.reveal
identity.hide

member.mute
member.unmute
member.remove
member.ban
```

### Server → Client

```text
connection.ready

room.joined
room.join.failed
room.closed

member.joined
member.left
member.online
member.offline

message.created
message.rejected

typing.started
typing.stopped

identity.revealed
identity.hidden

member.muted
member.unmuted
member.removed
member.banned
```

---

# 45. Event Payload Rules

Payloads should be:

* Small
* Explicit
* Validated
* Versionable
* Free from unnecessary sensitive data

Avoid sending entire database records.

Bad:

```json
{
  "member": {
    "...every database field..."
  }
}
```

Good:

```json
{
  "memberId": "uuid",
  "displayName": "Silent Fox"
}
```

---

# 46. Server Event Validation

Socket payloads must be validated exactly like HTTP requests.

Recommended:

**Zod**

Example conceptual schema:

```text
identity.reveal
    ↓
{
    memberId: UUID
}
```

Reject malformed payloads before business logic executes.

---

# 47. Socket Error Handling

Never allow socket exceptions to crash the server.

Errors should be converted into safe events/responses.

Example:

```text
message.rejected
```

with:

```json
{
  "code": "INVALID_MESSAGE",
  "message": "Unable to send this message."
}
```

Internal error details belong in server logs.

---

# 48. Duplicate Messages

Network retries can potentially cause duplicate submissions.

Messages should have a client-generated temporary ID or idempotency identifier.

Example:

```json
{
  "clientMessageId": "uuid",
  "content": "hello"
}
```

The backend can use this to prevent accidental duplicate persistence.

The client ID must not replace the server-generated message ID.

---

# 49. Message Ordering

The database timestamp should not be the only mechanism used to determine strict message ordering under heavy concurrency.

The server-generated message ID and creation sequence should be used where required.

For MVP:

```text
created_at
+
database ordering
```

is sufficient.

Future high-scale architecture can introduce stronger sequencing.

---

# 50. Missed Messages

If a user disconnects:

```text
User offline
 ↓
Messages continue arriving
 ↓
User reconnects
```

Do not attempt to send every missed message through Socket.IO automatically.

Instead:

```text
Reconnect
 ↓
Rejoin
 ↓
Fetch message history
 ↓
Resume live events
```

This is more reliable.

---

# 51. Event Duplication

Clients should safely handle duplicate events.

For example:

```text
message.created
```

received twice should not display the same message twice.

Use the server-generated message ID as the unique identifier.

---

# 52. Event Ordering

For events affecting the same room state:

```text
identity.revealed
identity.hidden
```

the frontend should process them in received order but ultimately trust the latest server state.

If state becomes inconsistent:

```text
Fetch current room state
```

instead of attempting complex client-side recovery.

---

# 53. Socket Scaling

MVP:

```text
One backend instance
+
Socket.IO
+
PostgreSQL
```

is acceptable.

When multiple backend instances are introduced:

```text
Load Balancer
      ↓
┌─────┼─────┐
│     │     │
API   API   API
│     │     │
└─────┼─────┘
      ↓
Redis Socket.IO Adapter
```

Redis should be introduced when required for cross-instance event synchronization.

---

# 54. Redis Future Role

Redis may eventually handle:

* Socket.IO adapter
* Presence
* Rate limiting
* Temporary state
* Distributed locks

It should not replace PostgreSQL as the primary persistent database.

---

# 55. Security Requirements

The real-time system must enforce:

```text
Authentication
Authorization
Room membership
Role verification
Payload validation
Rate limiting
Message size limits
Event filtering
Sensitive-data filtering
```

The socket layer must follow the same security model as REST.

---

# 56. Logging

Log important server events:

```text
connection failure
authentication failure
room join failure
admin authorization failure
rate limit violations
moderation actions
unexpected socket errors
```

Do NOT log:

```text
passwords
Admin Keys
session tokens
full sensitive payloads
```

---

# 57. Monitoring

Production monitoring should track:

```text
active sockets
active rooms
messages/second
connection failures
reconnection rate
average message latency
socket errors
authentication failures
rate-limit events
```

These metrics help identify real-time reliability problems.

---

# 58. Real-Time MVP

The first implementation only needs:

```text
Socket connection
Room join/leave
Message send/receive
Presence
Typing indicators
Identity reveal
Identity hide
Basic moderation events
Reconnect
```

Do not build advanced distributed infrastructure before the MVP needs it.

---

# 59. Final Real-Time Principle

The real-time system must follow:

```text
CLIENT
   ↓
EVENT
   ↓
AUTHENTICATE
   ↓
AUTHORIZE
   ↓
VALIDATE
   ↓
DATABASE / SERVICE
   ↓
BROADCAST
   ↓
AUTHORIZED CLIENTS
```

Never:

```text
CLIENT
   ↓
EVENT
   ↓
BROADCAST
```

The backend must always remain the source of truth.

---

# 60. AI Coding Rules

AI coding agents must:

* use Socket.IO
* authenticate socket connections
* verify room membership
* verify admin permissions
* validate every socket payload
* rate-limit messages
* persist messages before broadcasting
* never trust client-provided user IDs
* never trust client-provided roles
* never broadcast hidden identities
* handle reconnects
* prevent duplicate messages
* keep sensitive data out of socket payloads

If a real-time implementation conflicts with `SECURITY.md`, security requirements take priority.

The goal is not merely a fast chat.

The goal is a **secure, consistent, server-authoritative real-time room.**


---
# Additional Realtime Requirements
- **Room Deletion**: On last member disconnect, the server starts a delay (to handle temporary reconnects). If no members reconnect within the delay, the room is deleted.
- **Admin Close Room**: When admin closes the room via API, the server emits `room.closed` to all connected sockets and disconnects them.

