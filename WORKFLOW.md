# VEIL — COMPLETE ROOM ENTRY & CREATION FLOW

Update the Veil landing page and create **three fully functional flows** connected to the same visual design system:

1. **Create a Room**
2. **Join Room as Member**
3. **Join Room as Admin**

All three flows must feel like parts of the same polished product.

Maintain the existing Veil design language:

* dark premium theme
* rounded UI
* subtle depth
* tactile interactions
* polished typography
* restrained accent color
* meaningful micro-interactions
* smooth transitions
* mobile responsive
* no AI-slop aesthetics

---

# 1. LANDING PAGE

The landing page has three main actions:

### Join Room as Member

For normal participants.

### Join Room as Admin

For an existing room administrator.

### Create a Room

For creating a new room and becoming its administrator.

All three buttons must have:

* consistent dimensions
* same corner radius
* same typography
* consistent hover states
* consistent press animation
* consistent icon treatment

They should feel like three parts of one system.

---

# 2. CREATE A ROOM

Clicking:

**Create a Room**

opens:

## Create your room

Supporting text:

"Set up a private room and invite your people."

---

## CREATE ROOM FORM

Fields:

### Room Name

Placeholder:

`Late Night Chaos`

Required.

---

### Room Description

Placeholder:

`What's happening in this room?`

Optional.

---

### Room Password

Placeholder:

`Create a room password`

Required.

This is the password normal members will use to join.

Include:

👁 Show / Hide

---

### ADMIN KEY

This is extremely important.

The creator must create or generate a **unique Admin Key**.

Label:

**Admin Key**

Supporting text:

"This key gives you administrator access to this room. Keep it private."

Two options:

**Generate secure key**

or

**Create my own key**

Recommended default:

Generate secure key.

Example generated key:

`V8K7-XP92-QM4L`

Allow:

**Copy**

**Show / Hide**

The Admin Key must never be treated as a normal room password.

It is the credential that proves the user is the administrator of this room.

---

# 3. ADMIN KEY RULE

Every room must have its own unique Admin Key.

Example:

Room A:

`VX7K2P`

Admin Key:

`VEIL-8K2X-91Q`

Room B:

`LM4P8A`

Admin Key:

`VEIL-7D91-XQ4`

An Admin Key belongs to ONE room.

It cannot be reused to access another room.

Do not display the Admin Key publicly.

---

# 4. CREATE ROOM SUBMISSION

Primary button:

**Create Room →**

On click:

**Creating room…**

Backend creates:

* Room
* Room ID
* Room password hash
* Admin key hash
* Creator/admin relationship

The Admin Key must be securely stored server-side.

Never store the plaintext Admin Key in the database.

---

# 5. ROOM CREATED SUCCESS SCREEN

After successful creation:

### ✓ Room created

**Late Night Chaos**

Show:

**Room ID**

`VX7K2P`

[Copy]

---

### Room Password

`••••••••`

[Show]

[Copy]

---

### Admin Key

`••••••••`

[Show]

[Copy]

Important warning:

**Save your Admin Key somewhere safe.**

"You'll need it whenever you join this room as an admin."

If this is the only time the plaintext Admin Key is displayed, clearly communicate:

**You may not be able to view this key again.**

---

## PRIMARY ACTION

**Enter Room as Admin →**

The creator should automatically receive an authenticated admin session.

They should NOT have to log in again immediately.

---

# 6. JOIN ROOM AS MEMBER

Clicking:

**Join Room as Member**

opens:

## Join a private room

Supporting text:

"Enter the room credentials to continue."

Fields:

### Room ID

`Enter room ID`

### Room Password

`Enter room password`

Show / Hide password.

---

## MEMBER AUTHENTICATION

Backend verifies:

Room exists

*

Room password is correct

*

Room is open

*

Participant limit has not been reached

↓

Member enters the room.

The member receives:

* room membership
* anonymous identity
* member session

They do NOT receive:

* Admin Key
* real identities of other anonymous users
* admin controls

---

# 7. JOIN ROOM AS ADMIN

Clicking:

**Join Room as Admin**

opens:

## Enter as Admin

Supporting text:

"Enter your room credentials to access administrator controls."

Fields:

### Room ID

`Enter room ID`

### Room Password

`Enter room password`

### Admin Key

`Enter your unique admin key`

Show / Hide.

Supporting text:

"Your Admin Key gives you control over this room."

---

# 8. ADMIN AUTHENTICATION

Backend must verify all three:

```text
Room ID
+
Room Password
+
Admin Key
```

All must match the SAME room.

Example:

User enters:

Room ID:

`VX7K2P`

Room Password:

`********`

Admin Key:

`VEIL-8K2X-91Q`

Backend verifies:

```text
Room exists
        ↓
Room password matches
        ↓
Admin key matches this room
        ↓
Admin relationship exists
        ↓
Admin session created
        ↓
Enter room
```

If any credential fails, do not expose unnecessary information.

Use generic errors where appropriate.

---

# 9. ADMIN KEY SECURITY

The frontend must NEVER decide whether an Admin Key is valid.

Do NOT do:

```text
if (adminKey === storedKey) {
    showAdminPanel();
}
```

The backend must verify it.

The database should store only a secure hash of the Admin Key.

Example:

```text
admin_key_hash
```

Never:

```text
admin_key
```

The plaintext key should never be exposed through:

* API responses
* frontend state
* WebSocket events
* database queries
* logs
* analytics

---

# 10. ADMIN SESSION

After successful Admin authentication:

Create an authenticated session containing the user's identity and room permissions.

Conceptually:

```text
User
 ↓
Authenticated
 ↓
Room Member
 ↓
Room Admin
```

Do not simply trust:

```text
isAdmin = true
```

from the frontend.

The backend must determine the user's role.

---

# 11. ROOM ROLE MODEL

Every room member has a role:

```text
member
admin
```

Initial version:

**One admin per room.**

The creator automatically becomes:

```text
role = admin
```

Everyone else:

```text
role = member
```

Future versions can add:

```text
moderator
co-admin
owner
```

Do not implement these yet.

---

# 12. AFTER MEMBER JOINS

Member enters the normal Veil room.

They see:

* Anonymous participants
* Chat
* Presence
* Reactions
* Room information

They do NOT see admin controls.

---

# 13. AFTER ADMIN JOINS

Admin enters the same room.

The chat experience remains the same, but the admin receives additional controls.

Admin can:

### Identity

* Reveal identity
* Hide identity

### Moderation

* Mute
* Remove
* Ban

### Room

* Room settings
* Invite members
* Manage room
* Close room

---

# 14. IDENTITY SYSTEM

When a member enters:

Real identity:

**Dhruv**

Inside room:

**Silent Fox**

Status:

**Anonymous**

The anonymous identity belongs to the user's membership in that specific room.

Different rooms can generate different anonymous identities.

---

# 15. REVEAL

Admin selects:

**Silent Fox**

Admin sees:

```text
Silent Fox

Real identity:
Dhruv

Status:
Anonymous
```

Admin clicks:

**Reveal Identity**

↓

Confirmation:

"Everyone in this room will be able to see their real identity."

↓

Confirm.

Backend changes:

```text
identity_visible = true
```

↓

Real-time event is sent.

Everyone sees:

```text
Dhruv
● Revealed
```

---

# 16. HIDE

Admin selects the revealed user.

Clicks:

**Hide Identity**

↓

Confirmation.

Backend:

```text
identity_visible = false
```

↓

Real-time update.

Everyone sees:

```text
Silent Fox
Anonymous
```

Again.

---

# 17. CRITICAL PRIVACY RULE

The backend must decide what identity information each user receives.

Normal member:

```text
Anonymous name only
```

Admin:

```text
Anonymous name
+
real identity
```

After reveal:

```text
Everyone
↓
real identity
```

Never send hidden real identities to normal members and simply hide them with frontend CSS/React.

This is a fundamental security requirement.

---

# 18. THREE FLOW SUMMARY

## CREATE

```text
Landing
 ↓
Create a Room
 ↓
Room name
 ↓
Room password
 ↓
Generate/Create unique Admin Key
 ↓
Create Room
 ↓
Room ID generated
 ↓
Admin session created
 ↓
Enter Room as Admin
```

---

## MEMBER

```text
Landing
 ↓
Join Room as Member
 ↓
Room ID
 ↓
Room Password
 ↓
Backend verification
 ↓
Create room membership
 ↓
Generate anonymous identity
 ↓
Enter Room
```

---

## ADMIN

```text
Landing
 ↓
Join Room as Admin
 ↓
Room ID
 ↓
Room Password
 ↓
Unique Admin Key
 ↓
Backend verification
 ↓
Verify admin relationship
 ↓
Create admin session
 ↓
Enter Room
```

---

# 19. UI CONSISTENCY

The following pages must feel like one coherent system:

### Create Room

**Create your room**

### Join Member

**Join a private room**

### Join Admin

**Enter as Admin**

Use the same:

* background
* typography
* input components
* button components
* radius system
* animation system
* error system
* loading system
* success system

Only the content and required credentials should change.

---

# 20. MICRO-INTERACTIONS

All three pages should share the same interaction language.

Inputs:

* focus elevation
* subtle border transition

Password:

* eye show/hide animation

Buttons:

* hover
* press
* loading

Validation:

* subtle success/error transitions

Copy:

`Copy`

↓

`✓ Copied`

Navigation:

smooth page transitions.

Do not overanimate.

---

# 21. FINAL PRODUCT MODEL

The complete Veil entry system is:

```text
                         VEIL
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          CREATE         MEMBER         ADMIN
             │             │             │
       Create Room      Room ID        Room ID
             │          Password       Password
       Room Password                     │
       Admin Key                         │
             │                        Admin Key
             │                           │
             └──────────────┬────────────┘
                            ↓
                       ROOM SYSTEM
                            ↓
                    Anonymous Members
                            ↓
                       Real-time Chat
                            ↓
                    Admin Identity Control
                            ↓
                     Reveal / Hide
```

The Admin Key is the **unique credential that connects an administrator to their specific room**.

It must be generated/created when the room is created and required whenever that administrator accesses the room through **Join as Admin**.
