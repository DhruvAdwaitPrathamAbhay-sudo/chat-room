// ── Veil Frontend Types ───────────────────────────────────────────────────────

export interface Member {
  id: string;
  anonymousName: string;
  anonymousAvatar: string;
  role: "admin" | "member";
  identityVisible: boolean;
  status: "active" | "muted" | "removed" | "banned";
  /** Only present when identityVisible === true (admin-resolved) */
  realName?: string;
}

export interface Message {
  id: string;
  content: string;
  displayName: string;
  identityVisible: boolean;
  /** membership id — not user id */
  senderId: string;
  createdAt: string;
}

export interface Room {
  id: string;
  roomCode: string;
  name: string;
  description?: string;
  maxMembers?: number;
  status: "active" | "closed";
}

export interface Membership {
  id: string;
  anonymousName: string;
  anonymousAvatar: string;
  role: "admin" | "member";
  identityVisible: boolean;
}

// ── Form value types ──────────────────────────────────────────────────────────

export interface JoinMemberFormValues {
  roomCode: string;
  password: string;
}

export interface JoinAdminFormValues {
  roomCode: string;
  password: string;
  adminKey: string;
}

export interface CreateRoomFormValues {
  name: string;
  description?: string;
  password: string;
  adminKey: string;
  maxMembers?: number;
}
