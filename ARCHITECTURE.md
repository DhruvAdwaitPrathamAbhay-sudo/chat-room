# VEIL — ARCHITECTURE.md

## 1. Architecture Goal

Veil is a real-time anonymous room chat application.

The architecture must support:

* Private rooms
* Anonymous identities
* Real-time chat
* Admin identity reveal/hide
* Admin moderation
* Secure authentication
* Room-level authorization
* Reliable reconnects
* Future scalability

The most important architectural principle is:

> **The backend is the authority for identity, permissions, room membership and security.**

The frontend is responsible for presentation and user interaction.

---

# 2. High-Level Architecture

```text
                         VEIL
                           │
                           ▼
                    ┌─────────────┐
                    │   Frontend  │
                    │   Next.js   │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
           REST          WebSocket      Auth
           API           Socket.IO      Session
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    ┌─────────────┐
                    │   Backend   │
                    │ Node/Express│
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        PostgreSQL       Cache        Services
        Database        (future)      (future)
```

---

# 3. Recommended Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
TanStack Query
Socket.IO Client
```

Responsibilities:

* UI
* Navigation
* Forms
* Client-side validation
* Chat interface
* Room interface
* Animations
* Optimistic UI where safe
* WebSocket connection
* Displaying server-authorized data

---

# 4. Backend

Recommended:

```text
Node.js
Express
TypeScript
Socket.IO
```

Responsibilities:

* Authentication
* Authorization
* Room management
* Admin verification
* Anonymous identity management
* Message handling
* Moderation
* Identity visibility
* WebSocket events
* Input validation
* Rate limiting
* Security

The backend is the central authority.

---

# 5. Database

Recommended:

**PostgreSQL**

Responsibilities:

* Users
* Rooms
* Room memberships
* Anonymous identities
* Messages
* Moderation records
* Reports
* Sessions
* Room configuration

The database must never be directly accessible from the browser.

---

# 6. Initial System Components

Veil should initially contain these major components:

```text
Frontend
Backend API
WebSocket Server
PostgreSQL
Authentication
```

Optional infrastructure:

```text
Redis
Object Storage
Error Monitoring
Analytics
```

Do not introduce additional infrastructure unless the product actually requires it.

---

# 7. Frontend Architecture

Recommended structure:

```text
frontend/

src/
│
├── app/
│
├── components/
│
├── features/
│   ├── auth/
│   ├── rooms/
│   ├── chat/
│   ├── participants/
│   ├── admin/
│   └── moderation/
│
├── hooks/
├── lib/
├── services/
├── types/
└── styles/
```

Feature-based organization should be preferred over one enormous components folder.

---

# 8. Frontend Responsibilities

Frontend handles:

```text
User interaction
↓
Form input
↓
Client validation
↓
API request
↓
Display server response
```

Frontend must NOT handle:

```text
Security authorization
Admin verification
Identity permission
Password verification
Room permission decisions
```

---

# 9. Backend Architecture

Recommended structure:

```text
backend/

src/
│
├── config/
│
├── routes/
│
├── controllers/
│
├── services/
│
├── repositories/
│
├── middleware/
│
├── validators/
│
├── socket/
│
├── auth/
│
├── utils/
│
├── types/
│
└── server.ts
```

---

# 10. Backend Request Flow

HTTP request:

```text
Client
 ↓
Route
 ↓
Authentication Middleware
 ↓
Authorization Middleware
 ↓
Validation
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
PostgreSQL
 ↓
Response
```

Do not put business logic directly inside route handlers.

---

# 11. Service Layer

Business logic belongs in services.

Examples:

```text
RoomService
AuthService
MembershipService
IdentityService
MessageService
ModerationService
AdminService
```

Example:

```text
RevealIdentity
     ↓
IdentityService
     ↓
Check room
     ↓
Check membership
     ↓
Check admin role
     ↓
Update database
     ↓
Broadcast event
```

---

# 12. Repository Layer

Repositories handle database interaction.

Example:

```text
RoomRepository
UserRepository
MembershipRepository
MessageRepository
ModerationRepository
```

Services should not contain raw SQL everywhere.

Instead:

```text
Service
 ↓
Repository
 ↓
Database
```

This keeps business logic and database access separated.

---

# 13. REST API

REST is responsible for operations that don't require persistent real-time communication.

Examples:

```text
Authentication
Room creation
Room information
Room joining
Admin authentication
Participant management
Room settings
Message history
Reports
```

Real-time chat and presence should use WebSockets.

---

# 14. WebSocket Architecture

Use:

**Socket.IO**

The WebSocket layer handles:

```text
Chat
Typing
Presence
Room membership updates
Identity reveal/hide
Moderation events
Connection state
```

---

# 15. Socket Connection Flow

```text
Client
 ↓
Socket connection
 ↓
Authenticate session
 ↓
Identify user
 ↓
Verify room membership
 ↓
Join authorized Socket.IO room
 ↓
Start receiving events
```

A socket must not be allowed to join arbitrary rooms.

---

# 16. Socket Room Model

Socket.IO rooms correspond to Veil rooms.

Example:

```text
room:VX7K2P
```

Members connected to that room receive events for that room.

Example:

```text
room:VX7K2P

 ├── User A
 ├── User B
 ├── User C
 └── Admin
```

A user must be authorized before joining the socket room.

---

# 17. Chat Message Flow

```text
User
 ↓
Socket.emit("message.send")
 ↓
Backend
 ↓
Authenticate
 ↓
Verify room membership
 ↓
Validate message
 ↓
Save message
 ↓
Create authorized message representation
 ↓
Broadcast
 ↓
Clients render message
```

The sender identity must come from the authenticated session.

---

# 18. Message Representation

Messages should not permanently store a display name.

Database:

```text
message
 ├── id
 ├── room_id
 ├── sender_id
 ├── content
 └── created_at
```

Display identity is resolved using:

```text
sender
+
room membership
+
identity visibility
+
viewer permissions
```

This allows identity visibility to change without rewriting every message.

---

# 19. Identity Architecture

The identity system is:

```text
User
 │
 └── Room Membership
       │
       ├── anonymous_name
       ├── anonymous_avatar
       └── identity_visible
```

Real identity remains associated with the user account.

Anonymous identity belongs to the room membership.

---

# 20. Identity Reveal Architecture

Admin action:

```text
Admin
 ↓
REST/WebSocket request
 ↓
Authentication
 ↓
Authorization
 ↓
IdentityService
 ↓
Database update
 ↓
Broadcast identity.revealed
 ↓
Clients update
```

The backend controls the entire operation.

---

# 21. Identity Hide Architecture

```text
Admin
 ↓
Authorization
 ↓
IdentityService
 ↓
identity_visible = false
 ↓
Broadcast identity.hidden
 ↓
Clients update
```

No frontend-only state change is sufficient.

---

# 22. Create Room Architecture

Flow:

```text
Creator
 ↓
Create Room Form
 ↓
POST /rooms
 ↓
Authentication
 ↓
Validate input
 ↓
Generate Room ID
 ↓
Generate Admin Key
 ↓
Hash room password
 ↓
Hash Admin Key
 ↓
Create room
 ↓
Create admin membership
 ↓
Create admin session
 ↓
Return room information
```

The plaintext Admin Key is shown to the creator only when necessary.

The backend stores only its hash.

---

# 23. Join as Member Architecture

```text
Member
 ↓
Room ID + Password
 ↓
POST /rooms/:roomId/join
 ↓
Authenticate
 ↓
Find room
 ↓
Verify password
 ↓
Check room status
 ↓
Check member limit
 ↓
Create membership
 ↓
Generate anonymous identity
 ↓
Return authorized room data
```

---

# 24. Join as Admin Architecture

```text
Admin
 ↓
Room ID
+
Room Password
+
Admin Key
 ↓
POST /rooms/:roomId/admin-access
 ↓
Authenticate
 ↓
Verify room password
 ↓
Verify Admin Key
 ↓
Verify admin relationship
 ↓
Create admin session/authorization
 ↓
Return authorized room data
```

Admin access must always be verified by the backend.

---

# 25. Room Authorization Model

Every request involving a room must answer:

```text
Who is the user?

Which room?

Is the user a member?

What is their role?

What are they allowed to do?
```

Example:

```text
User A
 ↓
Room A
 ↓
Member
 ↓
Can chat
 ↓
Cannot reveal identities
```

Admin:

```text
User B
 ↓
Room A
 ↓
Admin
 ↓
Can chat
 ↓
Can reveal identities
 ↓
Can moderate
```

---

# 26. Database Relationship Model

Core relationship:

```text
User
 │
 ├──────────────┐
 │              │
 ▼              ▼
Room         Messages
 │              ▲
 │              │
 ▼              │
RoomMember ─────┘
```

More specifically:

```text
users
  │
  │ 1:N
  ▼
room_members
  │
  │ N:1
  ▼
rooms

users
  │
  │ 1:N
  ▼
messages

rooms
  │
  │ 1:N
  ▼
messages
```

---

# 27. Room Ownership

Initial version:

```text
rooms.admin_id
```

The room creator becomes the room admin.

Future architecture may replace this with:

```text
room_admins
```

to support multiple administrators.

Do not implement multiple administrators in MVP unless required.

---

# 28. Data Flow — Normal Member

```text
Member
 ↓
Frontend
 ↓
Backend
 ↓
Authentication
 ↓
Room membership
 ↓
Permission filtering
 ↓
Database
 ↓
Authorized response
 ↓
Frontend
```

The member should only receive information they are permitted to see.

---

# 29. Data Flow — Admin

```text
Admin
 ↓
Frontend
 ↓
Backend
 ↓
Authentication
 ↓
Room membership
 ↓
Admin authorization
 ↓
Database
 ↓
Admin-authorized response
 ↓
Frontend
```

Admin responses may contain additional identity information.

---

# 30. Real-Time Data Flow

```text
Database change
       ↓
Backend
       ↓
Socket.IO
       ↓
Authorized room clients
       ↓
Frontend state update
```

Not every database event should automatically be broadcast.

The backend should explicitly decide which event is sent and to whom.

---

# 31. Event Categories

### Chat

```text
message.created
message.updated
message.deleted
```

### Presence

```text
member.joined
member.left
member.online
member.offline
```

### Identity

```text
identity.revealed
identity.hidden
```

### Moderation

```text
member.muted
member.unmuted
member.removed
member.banned
```

### Room

```text
room.updated
room.closed
```

### Connection

```text
connection.ready
connection.reconnecting
connection.restored
```

---

# 32. State Management

Frontend state should be divided into:

### Server State

Examples:

```text
room
members
messages
room settings
```

Use:

**TanStack Query**

where appropriate.

### Real-Time State

Examples:

```text
typing
presence
live identity changes
connection status
```

Use Socket.IO events to update local state.

### UI State

Examples:

```text
modal open
selected participant
sidebar open
theme
input value
```

Use React state.

Avoid introducing a global state library until the complexity requires one.

---

# 33. Caching

Room information may be cached carefully.

Never cache sensitive information where unauthorized users could access it.

Do not cache:

```text
Admin Key
room password
hidden real identities
session secrets
```

Identity-sensitive responses must respect viewer permissions.

---

# 34. Scalability Strategy

Initial deployment:

```text
Frontend
 ↓
Backend
 ↓
PostgreSQL
```

For early usage this is sufficient.

When real-time traffic grows:

```text
Load Balancer
       │
 ┌─────┼─────┐
 ▼     ▼     ▼
API  API    API
 │     │     │
 └─────┼─────┘
       ▼
 Redis / Socket Adapter
       │
       ▼
 PostgreSQL
```

Do not introduce Redis solely because it is common in production architectures.

Add it when scaling requires it.

---

# 35. Database Transactions

Use database transactions for operations where multiple changes must succeed together.

Example room creation:

```text
Create room
+
Create admin membership
+
Set admin relationship
```

If one fails, the entire operation should roll back.

---

# 36. Failure Handling

Every important operation should handle:

```text
Validation failure
Authentication failure
Authorization failure
Database failure
Network failure
WebSocket failure
Timeout
Duplicate request
```

Frontend should display useful user-facing states.

Backend should log technical details without exposing secrets.

---

# 37. Idempotency

Important operations should be protected against accidental duplicate execution.

Examples:

```text
Create room
Send message
Join room
Reveal identity
```

Particularly important when clients retry after network failures.

---

# 38. API and WebSocket Separation

Use REST for:

```text
CRUD
Authentication
Room management
History
Settings
```

Use WebSockets for:

```text
Live chat
Presence
Typing
Live identity changes
Moderation events
```

Do not force every operation through WebSockets.

---

# 39. Security Boundary

The architecture has a strict security boundary:

```text
                UNTRUSTED
                   │
                   ▼
              Frontend
                   │
             HTTP / WS
                   │
                   ▼
             SECURITY WALL
                   │
                   ▼
               Backend
                   │
                   ▼
              PostgreSQL
```

The frontend never directly accesses PostgreSQL.

The frontend never makes final security decisions.

---

# 40. Production Deployment

Initial recommended structure:

```text
Internet
   │
   ▼
Frontend Hosting
   │
   ├── Next.js
   │
   ▼
Backend Hosting
   │
   ├── Express
   ├── Socket.IO
   │
   ▼
Managed PostgreSQL
```

Use HTTPS everywhere.

WebSocket connections must use WSS in production.

---

# 41. Environment Separation

Maintain separate environments:

```text
development
staging
production
```

Never use production secrets in development.

Never use development configuration in production.

---

# 42. Observability

Production system should eventually include:

```text
Application logs
Error monitoring
Database monitoring
WebSocket connection monitoring
Performance monitoring
```

Important metrics:

```text
active rooms
active connections
messages/minute
failed authentication attempts
failed admin authentication attempts
WebSocket disconnect rate
API latency
database latency
```

Do not log sensitive content unnecessarily.

---

# 43. Architecture Rules for AI Agents

AI coding agents must follow this architecture.

They must not:

* bypass service layers
* put database logic inside UI components
* expose database credentials
* implement authorization in frontend
* directly connect frontend to PostgreSQL
* create arbitrary WebSocket room joins
* duplicate security logic inconsistently
* store plaintext credentials
* expose hidden identities

When uncertain:

**Prefer the backend-controlled, server-authoritative design.**

---

# 44. MVP Architecture

The first production MVP should remain simple:

```text
                 ┌───────────────┐
                 │   Next.js     │
                 │   Frontend    │
                 └───────┬───────┘
                         │
                 HTTP + WebSocket
                         │
                         ▼
                 ┌───────────────┐
                 │ Node + Express│
                 │   Socket.IO   │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │  PostgreSQL   │
                 └───────────────┘
```

This is enough for the initial product.

---

# 45. Core Architectural Principle

Veil is fundamentally built around:

```text
Room
 ↓
Membership
 ↓
Anonymous Identity
 ↓
Permissions
 ↓
Real-Time Communication
```

The architecture must preserve this relationship.

The chat itself is relatively straightforward.

The difficult and most important part is:

> **Securely controlling who can see which identity information inside a real-time room.**

Therefore, identity, authorization and room membership must remain backend-controlled throughout the entire application.
