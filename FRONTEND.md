# 70. Stitch Design Source of Truth

The project includes Stitch-generated UI screens supplied by the product owner.

These screens are the **primary visual reference** for the frontend implementation.

The coding agent must inspect and understand the uploaded Stitch screens before implementing or modifying the corresponding frontend pages.

## Design Priority

Follow this priority order:

```text
1. Functional requirements
2. Security requirements
3. Existing Stitch designs
4. Existing component/design system
5. Developer assumptions
```

Do NOT replace the Stitch design with a generic AI-generated UI.

---

## 70.1 Stitch Screens Must Be Recreated, Not Reimagined

When implementing a page that has a corresponding Stitch screen:

* Match the overall layout.
* Match spacing and proportions.
* Match typography hierarchy.
* Match colors.
* Match border radius.
* Match button appearance.
* Match card treatment.
* Match navigation.
* Match icon placement.
* Match responsive intent.
* Match visual hierarchy.
* Match animations/interactions where they are obvious from the design.

The goal is:

> **Turn the Stitch design into a real production interface, not create another interpretation of it.**

---

## 70.2 Do Not Blindly Copy Bad AI Patterns

Stitch is the design reference, but it is not automatically correct from a UX or engineering perspective.

If a Stitch screen contains:

* fake functionality
* redundant UI
* impossible interactions
* inconsistent states
* inaccessible controls
* security-sensitive information exposed in the UI
* components that conflict with the backend workflow

then preserve the **visual language** while correcting the underlying implementation.

Example:

If Stitch visually shows an Admin Key:

```text
Admin Key: VEIL-1234
```

the production implementation must only display the key where the security workflow allows it.

---

## 70.3 Existing Stitch Screens

The uploaded screens should be mapped to the application's routes.

Expected mapping:

```text
Landing Screen
        ↓
/

Join Member Screen
        ↓
/join

Join Admin Screen
        ↓
/admin

Create Room Screen
        ↓
/create

Member Room Screen
        ↓
/room/[roomCode]

Admin Room Screen
        ↓
/admin/[roomCode]
```

If additional Stitch screens exist, map them to the appropriate feature rather than creating duplicate pages.

---

## 70.4 Preserve the Existing Visual Identity

Do not automatically introduce:

```text
new color palettes
new gradients
new typography
new design language
new card styles
new button styles
new navigation patterns
```

unless required by functionality or accessibility.

The uploaded Stitch screens already establish the visual identity of Veil.

---

## 70.5 Interactive States

Stitch screens may represent only the ideal/default state.

The production implementation must additionally support:

```text
Loading
Empty
Error
Disabled
Hover
Focus
Pressed
Submitting
Success
Connection lost
Reconnecting
Permission denied
Room closed
Member removed
Identity revealed
Identity hidden
```

These states should use the same visual language as the Stitch design.

---

## 70.6 Preserve Micro-Interactions

Where Stitch demonstrates or implies interaction, implement it properly.

Examples:

```text
button hover
button press
input focus
modal entrance
drawer animation
identity reveal
identity hide
message appearance
toast
copy interaction
password visibility
connection state
```

Animations should be:

```text
Fast
Subtle
Purposeful
Consistent
```

Do not add random animations merely to make the UI look impressive.

---

## 70.7 Responsive Adaptation

If Stitch provides desktop and mobile references, follow both.

If only desktop is provided:

Do NOT simply scale the desktop layout down.

Instead preserve the same design language while adapting:

```text
sidebar → drawer
participant panel → bottom sheet/drawer
multi-column layout → stacked layout
large controls → touch-friendly controls
```

The mobile implementation should feel intentionally designed.

---

## 70.8 Component Extraction

Repeated visual elements from Stitch should become reusable components.

Examples:

```text
VeilButton
VeilInput
VeilModal
VeilCard
VeilAvatar
RoomHeader
ParticipantCard
MessageBubble
AdminActionMenu
ConnectionIndicator
```

Do not duplicate the same markup across pages.

---

## 70.9 Do Not Over-Componentize

Do not create a separate component for every small `<div>`.

Create components when there is:

* repeated UI
* meaningful behavior
* independent state
* clear semantic responsibility

---

## 70.10 Stitch vs Backend Reality

The Stitch design describes **how the application looks**.

The backend architecture defines **what the application is allowed to do**.

Therefore:

```text
Stitch
  ↓
Visual design

Frontend
  ↓
Interaction

Backend
  ↓
Authorization + truth
```

Never modify backend security simply to reproduce a Stitch screen.

---

## 70.11 AI Slop Prevention

The coding agent must NOT redesign the supplied Stitch screens into a generic AI aesthetic.

Avoid adding:

```text
generic purple gradients
huge glowing headings
random glassmorphism
floating blobs
unnecessary dashboard cards
fake statistics
excessive rounded containers
AI-style decorative elements
unnecessary emojis
```

unless they already exist intentionally in the Stitch design.

The uploaded Stitch screens should remain recognizable after implementation.

---

## 70.12 Visual Review Requirement

After implementing a Stitch screen:

1. Compare the implementation against the Stitch reference.
2. Check spacing.
3. Check typography.
4. Check alignment.
5. Check component proportions.
6. Check responsive behavior.
7. Check interaction states.
8. Check whether unnecessary UI was introduced.

If the implementation looks substantially different from the Stitch reference, refine it before moving to the next page.

---

## 70.13 Functional Enhancement Without Visual Drift

The production version may contain additional elements that were not present in Stitch.

Examples:

```text
loading indicators
error messages
connection state
confirmation dialogs
permission errors
reconnection UI
empty states
validation messages
```

These should be integrated naturally into the existing Stitch design.

Do not create an entirely new visual system for them.

---

## 70.14 Final Rule

The uploaded Stitch screens are the **visual contract**.

Do not ask:

> "What UI should I generate?"

Ask:

> "How do I faithfully turn this existing design into a secure, responsive, production-quality application?"
# 70. Stitch Design Source of Truth

The project includes Stitch-generated UI screens supplied by the product owner.

These screens are the **primary visual reference** for the frontend implementation.

The coding agent must inspect and understand the uploaded Stitch screens before implementing or modifying the corresponding frontend pages.

## Design Priority

Follow this priority order:

```text
1. Functional requirements
2. Security requirements
3. Existing Stitch designs
4. Existing component/design system
5. Developer assumptions
```

Do NOT replace the Stitch design with a generic AI-generated UI.

---

## 70.1 Stitch Screens Must Be Recreated, Not Reimagined

When implementing a page that has a corresponding Stitch screen:

* Match the overall layout.
* Match spacing and proportions.
* Match typography hierarchy.
* Match colors.
* Match border radius.
* Match button appearance.
* Match card treatment.
* Match navigation.
* Match icon placement.
* Match responsive intent.
* Match visual hierarchy.
* Match animations/interactions where they are obvious from the design.

The goal is:

> **Turn the Stitch design into a real production interface, not create another interpretation of it.**

---

## 70.2 Do Not Blindly Copy Bad AI Patterns

Stitch is the design reference, but it is not automatically correct from a UX or engineering perspective.

If a Stitch screen contains:

* fake functionality
* redundant UI
* impossible interactions
* inconsistent states
* inaccessible controls
* security-sensitive information exposed in the UI
* components that conflict with the backend workflow

then preserve the **visual language** while correcting the underlying implementation.

Example:

If Stitch visually shows an Admin Key:

```text
Admin Key: VEIL-1234
```

the production implementation must only display the key where the security workflow allows it.

---

## 70.3 Existing Stitch Screens

The uploaded screens should be mapped to the application's routes.

Expected mapping:

```text
Landing Screen
        ↓
/

Join Member Screen
        ↓
/join

Join Admin Screen
        ↓
/admin

Create Room Screen
        ↓
/create

Member Room Screen
        ↓
/room/[roomCode]

Admin Room Screen
        ↓
/admin/[roomCode]
```

If additional Stitch screens exist, map them to the appropriate feature rather than creating duplicate pages.

---

## 70.4 Preserve the Existing Visual Identity

Do not automatically introduce:

```text
new color palettes
new gradients
new typography
new design language
new card styles
new button styles
new navigation patterns
```

unless required by functionality or accessibility.

The uploaded Stitch screens already establish the visual identity of Veil.

---

## 70.5 Interactive States

Stitch screens may represent only the ideal/default state.

The production implementation must additionally support:

```text
Loading
Empty
Error
Disabled
Hover
Focus
Pressed
Submitting
Success
Connection lost
Reconnecting
Permission denied
Room closed
Member removed
Identity revealed
Identity hidden
```

These states should use the same visual language as the Stitch design.

---

## 70.6 Preserve Micro-Interactions

Where Stitch demonstrates or implies interaction, implement it properly.

Examples:

```text
button hover
button press
input focus
modal entrance
drawer animation
identity reveal
identity hide
message appearance
toast
copy interaction
password visibility
connection state
```

Animations should be:

```text
Fast
Subtle
Purposeful
Consistent
```

Do not add random animations merely to make the UI look impressive.

---

## 70.7 Responsive Adaptation

If Stitch provides desktop and mobile references, follow both.

If only desktop is provided:

Do NOT simply scale the desktop layout down.

Instead preserve the same design language while adapting:

```text
sidebar → drawer
participant panel → bottom sheet/drawer
multi-column layout → stacked layout
large controls → touch-friendly controls
```

The mobile implementation should feel intentionally designed.

---

## 70.8 Component Extraction

Repeated visual elements from Stitch should become reusable components.

Examples:

```text
VeilButton
VeilInput
VeilModal
VeilCard
VeilAvatar
RoomHeader
ParticipantCard
MessageBubble
AdminActionMenu
ConnectionIndicator
```

Do not duplicate the same markup across pages.

---

## 70.9 Do Not Over-Componentize

Do not create a separate component for every small `<div>`.

Create components when there is:

* repeated UI
* meaningful behavior
* independent state
* clear semantic responsibility

---

## 70.10 Stitch vs Backend Reality

The Stitch design describes **how the application looks**.

The backend architecture defines **what the application is allowed to do**.

Therefore:

```text
Stitch
  ↓
Visual design

Frontend
  ↓
Interaction

Backend
  ↓
Authorization + truth
```

Never modify backend security simply to reproduce a Stitch screen.

---

## 70.11 AI Slop Prevention

The coding agent must NOT redesign the supplied Stitch screens into a generic AI aesthetic.

Avoid adding:

```text
generic purple gradients
huge glowing headings
random glassmorphism
floating blobs
unnecessary dashboard cards
fake statistics
excessive rounded containers
AI-style decorative elements
unnecessary emojis
```

unless they already exist intentionally in the Stitch design.

The uploaded Stitch screens should remain recognizable after implementation.

---

## 70.12 Visual Review Requirement

After implementing a Stitch screen:

1. Compare the implementation against the Stitch reference.
2. Check spacing.
3. Check typography.
4. Check alignment.
5. Check component proportions.
6. Check responsive behavior.
7. Check interaction states.
8. Check whether unnecessary UI was introduced.

If the implementation looks substantially different from the Stitch reference, refine it before moving to the next page.

---

## 70.13 Functional Enhancement Without Visual Drift

The production version may contain additional elements that were not present in Stitch.

Examples:

```text
loading indicators
error messages
connection state
confirmation dialogs
permission errors
reconnection UI
empty states
validation messages
```

These should be integrated naturally into the existing Stitch design.

Do not create an entirely new visual system for them.

---

## 70.14 Final Rule

The uploaded Stitch screens are the **visual contract**.

Do not ask:

> "What UI should I generate?"

Ask:

> "How do I faithfully turn this existing design into a secure, responsive, production-quality application?"


---
# Additional Frontend Requirements
- **Room Closed State**: The frontend should show a clear "Room Closed" state when receiving the `room.closed` event or when attempting to join a closed room, and redirect the user appropriately.
- **Admin Close Action**: Provide an explicit "Close Room" action for the admin, which must require confirmation before execution.

