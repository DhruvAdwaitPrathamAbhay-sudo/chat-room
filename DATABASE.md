# VEIL — DATABASE.md

## 1. Purpose

This document defines the PostgreSQL database structure for Veil.

The database must support:

* Users
* Rooms
* Room memberships
* Anonymous identities
* Admin authorization
* Messages
* Moderation
* Reports
* Sessions
* Room settings

The database must enforce strong relationships between users, rooms and memberships.

---

# 2. Database

Use:

**PostgreSQL**

The database must only be accessed by the backend.

```text
Frontend
    ↓
Backend
    ↓
PostgreSQL
```

The frontend must NEVER connect directly to PostgreSQL.

---

# 3. Core Data Model

The core relationship is:

```text
USER
 │
 │ 1:N
 ▼
ROOM MEMBERSHIP
 │
 │ N:1
 ▼
ROOM
```

Messages:

```text
USER ────────┐
             │
             ▼
          MESSAGE
             │
             ▼
            ROOM
```

Conceptually:

```text
users
  │
  ├───────────────┐
  │               │
  ▼               ▼
room_members    messages
  │               │
  ▼               ▼
rooms ───────── messages
```

---

# 4. Users Table

Table:

```text
users
```

Purpose:

Stores the real identity/account information of users.

Recommended fields:

```text
id
name
email
avatar_url
created_at
updated_at
```

Example:

```text
id: UUID
name: Dhruv
email: user@example.com
```

## Rules

* `id` must be a UUID.
* Email must be unique if email authentication is used.
* Real identity must never be exposed to normal room members.
* Do not store unnecessary personal information.

---

# 5. Rooms Table

Table:

```text
rooms
```

Purpose:

Represents a Veil room.

Recommended fields:

```text
id
room_code
name
description
password_hash
admin_key_hash
owner_id
max_members
status
created_at
updated_at
```

---

## Room ID

Internal:

```text
id UUID
```

Public room identifier:

```text
room_code
```

Example:

```text
id:
550e8400-e29b-41d4-a716-446655440000

room_code:
VX7K2P
```

The public `room_code` is what users enter when joining.

It should be unique.

---

# 6. Room Password

Store:

```text
password_hash
```

Never:

```text
password
```

Use a strong password hashing algorithm such as:

**Argon2id**

The plaintext room password must never be stored.

---

# 7. Admin Key

Store:

```text
admin_key_hash
```

Never:

```text
admin_key
```

The Admin Key is unique to the room.

It is used to authenticate administrative access.

---

# 8. Admin Key Uniqueness

The plaintext Admin Key should be cryptographically random.

The database should enforce uniqueness where practical through the stored representation.

However, uniqueness is primarily guaranteed through sufficiently strong random generation.

The system must never generate predictable Admin Keys.

---

# 9. Room Owner

Field:

```text
owner_id
```

References:

```text
users.id
```

The creator of the room becomes the initial owner/admin.

Example:

```text
rooms.owner_id
       ↓
users.id
```

The owner is automatically given an administrative membership.

---

# 10. Room Status

Recommended values:

```text
active
closed
```

Future:

```text
archived
suspended
```

MVP only requires:

```text
active
closed
```

A closed room cannot accept new members.

Existing sessions should be handled according to room-closing policy.

---

# 11. Maximum Members

Field:

```text
max_members
```

Example:

```text
10
25
50
100
```

The backend must enforce this limit.

The frontend must not be trusted to enforce it.

---

# 12. Room Members Table

Table:

```text
room_members
```

This is one of the most important tables in Veil.

It represents a user's membership inside a specific room.

Recommended fields:

```text
id
room_id
user_id
anonymous_name
anonymous_avatar
role
identity_visible
status
joined_at
updated_at
```

---

# 13. Why Anonymous Identity Belongs Here

Do NOT store:

```text
users.anonymous_name
```

because anonymous identity is room-specific.

Correct:

```text
room_members.anonymous_name
```

Example:

```text
User:
Dhruv

Room A:
Silent Fox

Room B:
Shadow Wolf
```

---

# 14. Room Membership Relationship

Each membership connects:

```text
user
+
room
```

Example:

```text
room_members

user_id → users.id
room_id → rooms.id
```

A user may belong to many rooms.

A room may contain many users.

This creates a many-to-many relationship between users and rooms through `room_members`.

---

# 15. Unique Membership Constraint

A user should not have multiple active memberships in the same room.

Recommended database constraint:

```text
UNIQUE(room_id, user_id)
```

This prevents accidental duplicate memberships.

---

# 16. Anonymous Name

Field:

```text
anonymous_name
```

Example:

```text
Silent Fox
Shadow Wolf
Ghost Panda
```

This is the display identity while anonymous.

It should be generated server-side.

Do not allow users to impersonate another member's anonymous identity.

---

# 17. Anonymous Avatar

Optional:

```text
anonymous_avatar
```

This can be:

* predefined avatar ID
* generated avatar
* abstract icon

Avoid requiring uploaded profile images in the MVP.

---

# 18. Role

Field:

```text
role
```

MVP values:

```text
member
admin
```

The room creator receives:

```text
admin
```

Normal participants receive:

```text
member
```

Future:

```text
moderator
co_admin
```

Do not implement unnecessary roles in MVP.

---

# 19. Identity Visibility

Field:

```text
identity_visible
```

Boolean.

Default:

```text
false
```

Meaning:

```text
false
=
anonymous

true
=
real identity is revealed
```

This field must only be modified through authorized backend operations.

---

# 20. Membership Status

Recommended:

```text
active
muted
removed
banned
```

MVP can begin with:

```text
active
banned
```

Additional states can be added as moderation expands.

---

# 21. Messages Table

Table:

```text
messages
```

Recommended fields:

```text
id
room_id
sender_id
content
created_at
updated_at
deleted_at
```

---

# 22. Message Identity Model

Messages should reference:

```text
sender_id
```

not:

```text
sender_anonymous_name
```

Example:

```text
message.sender_id
       ↓
users.id
```

When displaying the message, the backend resolves the appropriate identity using the sender's room membership.

This allows identity reveal/hide to work dynamically.

---

# 23. Message Room Relationship

Every message belongs to exactly one room.

```text
messages.room_id
        ↓
rooms.id
```

A message must never be accessible outside its room.

---

# 24. Message Sender Relationship

Every message belongs to an authenticated user.

```text
messages.sender_id
        ↓
users.id
```

The sender ID must come from the authenticated backend session.

Never trust a client-provided sender ID.

---

# 25. Message Content

Field:

```text
content
```

Store the message content as text.

Recommended MVP maximum:

```text
2000 characters
```

The backend must validate this.

Frontend validation is not sufficient.

---

# 26. Deleted Messages

Use:

```text
deleted_at
```

for soft deletion where appropriate.

Example:

```text
deleted_at = NULL
```

means active.

A timestamp means deleted.

This allows moderation history and future auditing.

---

# 27. Reports Table

Table:

```text
reports
```

Purpose:

Allows members to report inappropriate content or users.

Recommended fields:

```text
id
room_id
reporter_id
reported_user_id
message_id
reason
status
created_at
resolved_at
```

Possible status:

```text
open
reviewed
resolved
dismissed
```

---

# 28. Report Relationships

Reporter:

```text
reports.reporter_id
        ↓
users.id
```

Reported user:

```text
reports.reported_user_id
        ↓
users.id
```

Room:

```text
reports.room_id
        ↓
rooms.id
```

Optional message:

```text
reports.message_id
        ↓
messages.id
```

---

# 29. Moderation Actions Table

Table:

```text
moderation_actions
```

Purpose:

Track important administrative actions.

Recommended fields:

```text
id
room_id
admin_id
target_user_id
action
metadata
created_at
```

Examples:

```text
identity_revealed
identity_hidden
member_muted
member_unmuted
member_removed
member_banned
message_deleted
```

---

# 30. Why Moderation History Matters

Anonymous applications need accountability for administrators.

Example:

```text
Admin
 ↓
Revealed user
 ↓
Database records:
who performed action
which room
which user
when
```

This should not expose the information publicly.

It is for internal auditing and security.

---

# 31. Sessions Table

If using database-backed sessions:

```text
sessions
```

Recommended fields:

```text
id
user_id
expires_at
created_at
last_used_at
```

Optional:

```text
ip_hash
user_agent_hash
```

Only collect additional information if actually required.

---

# 32. Authentication Architecture

Authentication/session storage can use the authentication framework chosen during implementation.

The important requirement is:

```text
session
 ↓
authenticated user
 ↓
backend
```

The backend must determine the user's identity from the session.

Do not trust a `userId` supplied by the frontend.

---

# 33. Room Invitations

For MVP, joining can use:

```text
room_code
+
room_password
```

Do not create a complicated invitation system yet.

Future:

```text
invite_tokens
invite links
QR codes
expiration
single-use invites
```

can be added later.

---

# 34. Room Settings

Avoid creating a huge settings table initially.

Simple room settings can live directly on:

```text
rooms
```

Possible fields:

```text
max_members
status
```

Future settings:

```text
allow_reactions
slow_mode
allow_media
allow_member_reports
```

can be added later.

---

# 35. Database Constraints

Important constraints:

```text
users.email
    UNIQUE

rooms.room_code
    UNIQUE

room_members(room_id, user_id)
    UNIQUE
```

Foreign keys must be used for relationships.

Example:

```text
room_members.room_id
    REFERENCES rooms.id
```

---

# 36. Indexes

Important indexes should include:

```text
rooms.room_code
room_members.room_id
room_members.user_id
messages.room_id
messages.sender_id
messages.created_at
reports.room_id
moderation_actions.room_id
```

Messages should be indexed for efficient room history retrieval.

---

# 37. Message Pagination

Do NOT load every message in a room at once.

Use pagination.

Recommended initial approach:

```text
GET latest 50 messages
```

Then load older messages when requested.

Future:

```text
cursor-based pagination
```

is preferred for large rooms.

---

# 38. Database Query Security

All database queries must use parameterized queries or a safe ORM/query builder.

Never construct SQL using raw user input.

Wrong:

```text
"SELECT * FROM rooms WHERE room_code = '" + roomCode + "'"
```

Correct:

```text
parameterized query
```

or ORM equivalent.

---

# 39. Transactions

Use database transactions when multiple related records must be created or modified together.

### Create Room

```text
BEGIN

Create room

Create owner membership

COMMIT
```

If either fails:

```text
ROLLBACK
```

---

# 40. Reveal Transaction

Reveal operation should be atomic:

```text
BEGIN

Verify membership
Verify admin permission
Set identity_visible = true
Create moderation action

COMMIT
```

Then broadcast the real-time event.

Do not broadcast before the database transaction succeeds.

---

# 41. Hide Transaction

Same principle:

```text
BEGIN

Verify admin
Set identity_visible = false
Create moderation action

COMMIT
```

Then:

```text
broadcast identity.hidden
```

---

# 42. Deleting a Room

Room deletion should be carefully handled because it affects:

```text
members
messages
reports
moderation history
```

For MVP, prefer:

```text
status = closed
```

rather than immediately hard-deleting everything.

Permanent deletion can be implemented later with an explicit retention policy.

---

# 43. Cascading Deletes

Foreign-key cascade behavior must be deliberately chosen.

Do not blindly use:

```text
ON DELETE CASCADE
```

for every table.

For example, deleting a room could accidentally delete important moderation information.

Each relationship should have an intentional deletion policy.

---

# 44. Data Retention

MVP should define a basic retention strategy.

Possible approach:

```text
Active rooms:
Normal storage

Closed rooms:
Retained temporarily

Deleted rooms:
Permanently removed according to retention policy
```

Do not promise permanent anonymity if the system retains data that could later identify users.

---

# 45. Real Identity vs Anonymous Identity

Database structure must preserve this separation:

```text
users
│
│ Real identity
│
└───────────────┐
                │
                ▼
          room_members
                │
                │ Anonymous identity
                │
                ▼
              rooms
```

The anonymous identity must never replace the real identity in the user table.

---

# 46. Security-Critical Fields

These fields require especially strict backend control:

```text
rooms.password_hash
rooms.admin_key_hash
rooms.owner_id

room_members.user_id
room_members.room_id
room_members.role
room_members.identity_visible
room_members.status

messages.sender_id
messages.room_id
```

Clients must not be allowed to arbitrarily modify these fields.

---

# 47. Recommended Initial Schema

Core MVP tables:

```text
users
rooms
room_members
messages
sessions
```

Security/moderation tables:

```text
reports
moderation_actions
```

This is enough for the first production-ready version.

---

# 48. Simplified Schema

```text
┌──────────────┐
│    users     │
├──────────────┤
│ id           │
│ name         │
│ email        │
│ avatar_url   │
│ created_at   │
└──────┬───────┘
       │
       │
       ▼
┌────────────────────┐
│   room_members     │
├────────────────────┤
│ id                 │
│ room_id            │
│ user_id            │
│ anonymous_name     │
│ anonymous_avatar   │
│ role               │
│ identity_visible   │
│ status             │
│ joined_at          │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│       rooms        │
├────────────────────┤
│ id                 │
│ room_code          │
│ name               │
│ description        │
│ password_hash      │
│ admin_key_hash     │
│ owner_id           │
│ max_members        │
│ status             │
│ created_at          │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│      messages      │
├────────────────────┤
│ id                 │
│ room_id            │
│ sender_id          │
│ content            │
│ created_at         │
│ updated_at         │
│ deleted_at         │
└────────────────────┘
```

---

# 49. AI Coding Rules

AI coding agents must follow this schema.

They must not:

* store plaintext passwords
* store plaintext Admin Keys
* move anonymous identity into the users table
* allow duplicate active memberships
* trust client-provided sender IDs
* trust client-provided roles
* trust client-provided identity visibility
* expose hidden real identities
* bypass foreign-key relationships
* create unscoped room queries

If generated code conflicts with this document:

**DATABASE.md takes priority for data-model decisions.**

Security rules in `SECURITY.md` still apply.

---

# 50. Final Database Principle

The database should represent the real relationship:

```text
USER
  ↓
ROOM MEMBERSHIP
  ↓
ANONYMOUS IDENTITY
  ↓
ROOM
  ↓
MESSAGES
```

The most important design decision is:

> **Anonymity is a property of a user's membership inside a room, not a property of the user itself.**

This allows Veil to safely support:

* different anonymous identities per room
* reveal/hide functionality
* room-specific permissions
* multiple rooms
* future moderation
* future multi-admin support
* scalable real-time chat


---
# Additional Core Requirements

## Automatic Room Deletion
A room must automatically be deleted when the last active member leaves.
- Deletion must be handled server-side.
- The server must handle disconnects/reconnections carefully so a temporary network disconnect does not immediately destroy a room incorrectly.

## Random Anonymous Titles
Every time a user joins a room, assign them a random anonymous identity/title generated server-side.
- Title must be unique within the room.
- Store the generated anonymous identity with the room membership.
- Anonymous identities start fresh for every new room.

## Admin Close Room
The room admin can invoke a "Close Room" action.
- Room status changes to CLOSED.
- Prevent all new joins.
- Disconnect/terminate active room sessions and clean up room data.

