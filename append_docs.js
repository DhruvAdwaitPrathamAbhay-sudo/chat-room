const fs = require('fs');
const path = require('path');

const appendText = (filename, text) => {
  const filePath = path.join(__dirname, filename);
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, '\n\n' + text + '\n');
    console.log(`Appended to ${filename}`);
  }
};

appendText('database.md', `---
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
`);

appendText('api.md', `---
# Additional Endpoints

## POST /api/rooms/:roomCode/close
Closes the room explicitly. Only allowed by room admin.
Transitions room to CLOSED status, prevents new joins, and triggers socket disconnects and data cleanup.
`);

appendText('realtime.md', `---
# Additional Realtime Requirements
- **Room Deletion**: On last member disconnect, the server starts a delay (to handle temporary reconnects). If no members reconnect within the delay, the room is deleted.
- **Admin Close Room**: When admin closes the room via API, the server emits \`room.closed\` to all connected sockets and disconnects them.
`);

appendText('secuirty.md', `---
# Additional Security Rules
- **Anonymous Identity Uniqueness**: The server must generate unique anonymous identities per room. Real identity must never be leaked during generation.
- **Admin Close Room**: Only the authenticated room admin can close the room. Never trust a frontend \`isAdmin\` or \`role\` value.
`);

appendText('FRONTEND.md', `---
# Additional Frontend Requirements
- **Room Closed State**: The frontend should show a clear "Room Closed" state when receiving the \`room.closed\` event or when attempting to join a closed room, and redirect the user appropriately.
- **Admin Close Action**: Provide an explicit "Close Room" action for the admin, which must require confirmation before execution.
`);

appendText('TESTING.md', `---
# Additional Testing Requirements
- **Automatic Room Deletion**: Verify that when the last member leaves (and after a brief reconnect timeout), the room is deleted from the database.
- **Anonymous Title Uniqueness**: Verify that members in the same room get unique titles, and titles reset when joining a new room.
- **Admin Close Room**: Verify that only the admin can trigger closure, that the room becomes CLOSED, new joins are rejected, and connected users receive the \`room.closed\` event.
`);
