/**
 * frontend/src/lib/api.ts
 *
 * Real API client helper for communicating with the Veil backend.
 * Uses HTTP-only cookie credentials for secure session management.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  code: string;

  constructor(message: string, code: string = "UNKNOWN_ERROR") {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Transmit and receive HTTP-only veil_session cookie
  });

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      "Failed to parse server response.",
      "INVALID_SERVER_RESPONSE"
    );
  }

  if (!json.success || json.error) {
    throw new ApiError(
      json.error?.message || "An unexpected error occurred.",
      json.error?.code || "API_ERROR"
    );
  }

  return json.data as T;
}

// ── Auth Endpoints ────────────────────────────────────────────────────────────

export async function getMe() {
  return request<{ user: { id: string; name: string } }>("/auth/me");
}

export async function logout() {
  return request<{ success: boolean }>("/auth/logout", { method: "POST" });
}

// ── Room Endpoints ────────────────────────────────────────────────────────────

export interface CreateRoomResponse {
  room: {
    id: string;
    roomCode: string;
    name: string;
    description?: string;
    maxMembers?: number;
    status: string;
  };
  membership: {
    id: string;
    anonymousName: string;
    anonymousAvatar: string;
    role: string;
    identityVisible: boolean;
  };
  adminKey: string;
}

export async function createRoom(payload: {
  name: string;
  description?: string;
  password: string;
  globalAdminKey: string;
  maxMembers?: number;
}) {
  return request<CreateRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface JoinRoomResponse {
  room: {
    id: string;
    roomCode: string;
    name: string;
    description?: string;
  };
  membership: {
    id: string;
    anonymousName: string;
    anonymousAvatar: string;
    role: string;
    identityVisible: boolean;
  };
}

export async function joinRoom(realName: string, roomName: string, password: string) {
  return request<JoinRoomResponse>("/rooms/join", {
    method: "POST",
    body: JSON.stringify({ realName, roomName, password }),
  });
}

export async function clearAllRooms(globalAdminKey: string) {
  return request<{ success: true; deletedRooms: number }>("/admin/rooms/clear", {
    method: "POST",
    body: JSON.stringify({ globalAdminKey }),
  });
}

export async function adminAccess(
  roomCode: string,
  password: string,
  adminKey: string
) {
  return request<JoinRoomResponse>(`/rooms/${roomCode}/admin-access`, {
    method: "POST",
    body: JSON.stringify({ password, adminKey }),
  });
}

export interface GetRoomResponse {
  room: {
    id: string;
    roomCode: string;
    name: string;
    description?: string;
    maxMembers?: number;
    status: string;
  };
  membership: {
    id: string;
    anonymousName: string;
    anonymousAvatar: string;
    role: "admin" | "member";
    identityVisible: boolean;
    status: string;
  };
}

export async function getRoom(roomCode: string) {
  return request<GetRoomResponse>(`/rooms/${roomCode}`);
}

export interface MemberViewItem {
  id: string;
  displayName: string;
  realName?: string;
  avatar: string;
  role: "admin" | "member";
  identityVisible: boolean;
  status: string;
  isCurrentUser: boolean;
}

export async function getMembers(roomCode: string) {
  return request<{ members: MemberViewItem[] }>(`/rooms/${roomCode}/members`);
}

export interface MessageItem {
  id: string;
  content: string;
  displayName: string;
  identityVisible: boolean;
  senderId: string;
  createdAt: string;
}

export async function getMessages(
  roomCode: string,
  before?: string,
  limit = 50
) {
  const query = new URLSearchParams();
  if (before) query.set("before", before);
  if (limit) query.set("limit", limit.toString());

  const qs = query.toString() ? `?${query.toString()}` : "";
  return request<{ messages: MessageItem[]; nextCursor: string | null }>(
    `/rooms/${roomCode}/messages${qs}`
  );
}

// ── Moderation & Identity Actions (Admin) ────────────────────────────────────

export async function revealIdentity(roomCode: string, memberId: string) {
  return request<{ member: { id: string; identityVisible: boolean } }>(
    `/rooms/${roomCode}/members/${memberId}/reveal`,
    { method: "POST" }
  );
}

export async function hideIdentity(roomCode: string, memberId: string) {
  return request<{ member: { id: string; identityVisible: boolean } }>(
    `/rooms/${roomCode}/members/${memberId}/hide`,
    { method: "POST" }
  );
}

export async function muteMember(roomCode: string, memberId: string) {
  return request<{ success: boolean }>(
    `/rooms/${roomCode}/members/${memberId}/mute`,
    { method: "POST" }
  );
}

export async function unmuteMember(roomCode: string, memberId: string) {
  return request<{ success: boolean }>(
    `/rooms/${roomCode}/members/${memberId}/unmute`,
    { method: "POST" }
  );
}

export async function removeMember(roomCode: string, memberId: string) {
  return request<{ success: boolean }>(
    `/rooms/${roomCode}/members/${memberId}/remove`,
    { method: "POST" }
  );
}

export async function banMember(roomCode: string, memberId: string) {
  return request<{ success: boolean }>(
    `/rooms/${roomCode}/members/${memberId}/ban`,
    { method: "POST" }
  );
}

export async function closeRoom(roomCode: string) {
  return request<{ success: boolean }>(`/rooms/${roomCode}/close`, {
    method: "POST",
  });
}
