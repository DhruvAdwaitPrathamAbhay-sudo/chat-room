/**
 * frontend/src/lib/api.ts
 *
 * Real API client helper for communicating with the Veil backend.
 * Uses HTTP-only cookie credentials for secure session management.
 */

function getApiBaseUrl(): string {
  let raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  raw = raw.trim().replace(/\/+$/, "");
  if (!raw.endsWith("/api")) {
    raw = `${raw}/api`;
  }
  return raw;
}

const API_BASE = getApiBaseUrl();

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

import { supabase } from "./supabaseClient";

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
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach Supabase access token if present
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch {
    // Ignore session fetch errors
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Transmit and receive HTTP-only veil_session cookie
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      `Unable to connect to backend server (${msg}). Please verify network connection or NEXT_PUBLIC_API_URL configuration.`,
      "NETWORK_ERROR"
    );
  }

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

export async function joinPublicRoom(slug: string) {
  return request<JoinRoomResponse>(`/rooms/public/${slug}/join`, {
    method: "POST",
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
  onlineCount?: number;
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
  isOnline?: boolean;
}

export async function getMembers(roomCode: string) {
  return request<{ members: MemberViewItem[]; onlineCount?: number }>(`/rooms/${roomCode}/members`);
}

export interface MessageItem {
  id: string;
  content: string;
  displayName: string;
  identityVisible: boolean;
  senderId: string;
  createdAt: string;
  isEdited?: boolean;
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

export async function editMessage(
  roomCode: string,
  messageId: string,
  content: string
) {
  return request<{ message: { id: string; content: string; isEdited: boolean } }>(
    `/rooms/${roomCode}/messages/${messageId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }
  );
}

export async function deleteMessage(roomCode: string, messageId: string) {
  return request<{ success: boolean }>(
    `/rooms/${roomCode}/messages/${messageId}`,
    {
      method: "DELETE",
    }
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

export async function clearRoomMessages(roomCode: string) {
  return request<{ success: boolean; data: { clearedCount: number; message: string } }>(
    `/rooms/${roomCode}/clear-messages`,
    { method: "POST" }
  );
}

/** Admin access for PUBLIC rooms — only the global admin key is required */
export async function publicAdminAccess(roomCode: string, adminKey: string) {
  return request<JoinRoomResponse>(`/rooms/${roomCode}/admin-access`, {
    method: "POST",
    body: JSON.stringify({ adminKey }),
  });
}
