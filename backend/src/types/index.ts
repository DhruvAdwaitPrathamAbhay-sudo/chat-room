// Shared types for the Veil application

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface Room {
  id: string;
  roomCode: string;
  name: string;
  description?: string;
  ownerId: string;
  maxMembers: number;
  status: 'active' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  anonymousName: string;
  anonymousAvatar: string;
  role: 'member' | 'admin';
  identityVisible: boolean;
  status: 'active' | 'muted' | 'removed' | 'banned';
  joinedAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface ModerationAction {
  id: string;
  roomId: string;
  adminId: string;
  targetUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// The shape of authenticated session data
export interface SessionData {
  userId: string;
  name: string;
}

// Augment Express Request to include session user
declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionData;
    }
  }
}
