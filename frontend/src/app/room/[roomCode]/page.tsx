"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EyeSlashIcon,
  PeopleIcon,
  SendIcon,
  PlusCircleIcon,
  ChatIcon,
  DoorIcon,
  CrownIcon,
  LockIcon,
  Toast,
  Spinner,
} from "@/components/ui";
import {
  getRoom,
  getMessages,
  getMembers,
  clearRoomMessages,
  MemberViewItem,
  MessageItem as ApiMessageItem,
  ApiError,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";

export default function RoomChatPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  const router = useRouter();

  const { user, profile, loading: authLoading } = useAuth();

  const isPublicRoom =
    roomCode.startsWith("PUBLIC-") ||
    ["SU-VICHAR", "GESU-TALKS", "GAMING", "FORMAL-TALKS"].includes(roomCode);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("Loading room...");
  const [activeTab, setActiveTab] = useState<"chat" | "people">("chat");

  const [inputContent, setInputContent] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<string | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

  // Admin-only Clear Room state
  const [showClearRoomConfirm, setShowClearRoomConfirm] = useState(false);
  const [clearRoomLoading, setClearRoomLoading] = useState(false);

  const [members, setMembers] = useState<MemberViewItem[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [messages, setMessages] = useState<ApiMessageItem[]>([]);
  const [typingMembers, setTypingMembers] = useState<Set<string>>(new Set());
  const [myMembershipId, setMyMembershipId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive admin status from current member list (never trust from client payload alone)
  const myMember = members.find((m) => m.isCurrentUser);
  const isAdmin = myMember?.role === "admin";

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuMessageId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load initial data and connect Socket.IO
  useEffect(() => {
    // If public room, do not proceed until auth state is resolved
    if (isPublicRoom) {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      if (!profile?.real_name || profile.real_name === "Veil Member") {
        router.push(`/complete-profile?next=${encodeURIComponent(`/room/${roomCode.toLowerCase()}`)}`);
        return;
      }
    }

    let isSubscribed = true;
    const socket = connectSocket();

    async function initRoom() {
      try {
        setLoading(true);

        const roomRes = await getRoom(roomCode);
        if (!isSubscribed) return;

        setRoomName(roomRes.room.name);
        setMyMembershipId(roomRes.membership.id);
        if (typeof roomRes.onlineCount === "number" && roomRes.onlineCount > 0) {
          setOnlineCount(roomRes.onlineCount);
        }

        const [messagesRes, membersRes] = await Promise.all([
          getMessages(roomCode),
          getMembers(roomCode),
        ]);

        if (!isSubscribed) return;

        setMessages(messagesRes.messages);
        setMembers(membersRes.members);
        if (typeof membersRes.onlineCount === "number" && membersRes.onlineCount > 0) {
          setOnlineCount(membersRes.onlineCount);
        }

        const currentMember = membersRes.members.find((m) => m.isCurrentUser);
        if (currentMember) {
          setMyMembershipId(currentMember.id);
        }

        // Join socket room
        socket.emit("room.join", { roomCode });
      } catch (err) {
        if (!isSubscribed) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load room data.");
        }
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    initRoom();


    // Socket Event Listeners
    const handleJoined = (data: {
      roomCode: string;
      membership: { id: string; displayName: string; role: string };
      onlineCount?: number;
      onlineMemberIds?: string[];
    }) => {
      if (data.membership) setMyMembershipId(data.membership.id);
      if (typeof data.onlineCount === "number" && data.onlineCount > 0) {
        setOnlineCount(data.onlineCount);
      }
      if (Array.isArray(data.onlineMemberIds)) {
        const onlineSet = new Set(data.onlineMemberIds);
        setMembers((prev) =>
          prev.map((m) => ({ ...m, isOnline: onlineSet.has(m.id) }))
        );
      }
    };

    const handlePresence = (data: {
      onlineCount: number;
      onlineMemberIds?: string[];
    }) => {
      if (typeof data.onlineCount === "number") {
        setOnlineCount(data.onlineCount);
      }
      if (Array.isArray(data.onlineMemberIds)) {
        const onlineSet = new Set(data.onlineMemberIds);
        setMembers((prev) =>
          prev.map((m) => ({ ...m, isOnline: onlineSet.has(m.id) }))
        );
      }
    };

    const handleJoinFailed = (data: { code: string; message: string }) => {
      setError(data.message || "Failed to join socket room.");
    };

    const handleMessageCreated = (data: { message: ApiMessageItem }) => {
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    };

    const handleMessageUpdated = (data: {
      messageId: string;
      content: string;
      isEdited?: boolean;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, content: data.content, isEdited: true }
            : m
        )
      );
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      setEditingMessageId((cur) => (cur === data.messageId ? null : cur));
      setDeleteConfirmMessageId((cur) => (cur === data.messageId ? null : cur));
      setActiveMenuMessageId((cur) => (cur === data.messageId ? null : cur));
    };

    const handleMessageRejected = (data: { code: string; message: string }) => {
      setError(data.message || "Message rejected.");
    };

    const handleIdentityRevealed = (data: {
      memberId: string;
      displayName: string;
    }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === data.memberId
            ? { ...m, displayName: data.displayName, identityVisible: true }
            : m
        )
      );
      setMessages((prev) =>
        prev.map((msg) =>
          msg.senderId === data.memberId
            ? { ...msg, displayName: data.displayName, identityVisible: true }
            : msg
        )
      );
    };

    const handleIdentityHidden = (data: {
      memberId: string;
      displayName: string;
    }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === data.memberId
            ? { ...m, displayName: data.displayName, identityVisible: false }
            : m
        )
      );
      setMessages((prev) =>
        prev.map((msg) =>
          msg.senderId === data.memberId
            ? { ...msg, displayName: data.displayName, identityVisible: false }
            : msg
        )
      );
    };

    const handleMemberJoined = () => {
      getMembers(roomCode).then((res) => setMembers(res.members)).catch(() => {});
    };

    const handleMemberLeft = (data: { memberId: string }) => {
      setMembers((prev) => prev.filter((m) => m.id !== data.memberId));
    };

    const handleMemberMuted = (data: { memberId: string }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === data.memberId ? { ...m, status: "muted" } : m))
      );
    };

    const handleMemberRemoved = (data: { memberId: string }) => {
      setMembers((prev) => prev.filter((m) => m.id !== data.memberId));
    };

    const handleRoomClosed = (data: { message: string }) => {
      setError(data.message || "The room has been closed.");
      setTimeout(() => router.push("/"), 2500);
    };

    const handleMessagesCleared = () => {
      setMessages([]);
    };

    const handleTypingStart = (data: { memberId: string }) => {
      setTypingMembers((prev) => new Set(prev).add(data.memberId));
    };

    const handleTypingStop = (data: { memberId: string }) => {
      setTypingMembers((prev) => {
        const next = new Set(prev);
        next.delete(data.memberId);
        return next;
      });
    };

    socket.on("room.joined", handleJoined);
    socket.on("room.presence", handlePresence);
    socket.on("room.join.failed", handleJoinFailed);
    socket.on("message.created", handleMessageCreated);
    socket.on("message.updated", handleMessageUpdated);
    socket.on("message.deleted", handleMessageDeleted);
    socket.on("message.rejected", handleMessageRejected);
    socket.on("identity.revealed", handleIdentityRevealed);
    socket.on("identity.hidden", handleIdentityHidden);
    socket.on("member.joined", handleMemberJoined);
    socket.on("member.left", handleMemberLeft);
    socket.on("member.muted", handleMemberMuted);
    socket.on("member.removed", handleMemberRemoved);
    socket.on("member.banned", handleMemberRemoved);
    socket.on("room.closed", handleRoomClosed);
    socket.on("room.messages.cleared", handleMessagesCleared);
    socket.on("typing.start", handleTypingStart);
    socket.on("typing.stop", handleTypingStop);

    return () => {
      isSubscribed = false;
      socket.emit("room.leave");
      socket.off("room.joined", handleJoined);
      socket.off("room.presence", handlePresence);
      socket.off("room.join.failed", handleJoinFailed);
      socket.off("message.created", handleMessageCreated);
      socket.off("message.updated", handleMessageUpdated);
      socket.off("message.deleted", handleMessageDeleted);
      socket.off("message.rejected", handleMessageRejected);
      socket.off("identity.revealed", handleIdentityRevealed);
      socket.off("identity.hidden", handleIdentityHidden);
      socket.off("member.joined", handleMemberJoined);
      socket.off("member.left", handleMemberLeft);
      socket.off("member.muted", handleMemberMuted);
      socket.off("member.removed", handleMemberRemoved);
      socket.off("member.banned", handleMemberRemoved);
      socket.off("room.closed", handleRoomClosed);
      socket.off("room.messages.cleared", handleMessagesCleared);
      socket.off("typing.start", handleTypingStart);
      socket.off("typing.stop", handleTypingStop);
    };
  }, [roomCode, router]);

  // Handle typing indicator dispatch
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputContent(e.target.value);
    const socket = connectSocket();

    socket.emit("typing.start");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing.stop");
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputContent.trim();
    if (!content) return;

    const socket = connectSocket();
    socket.emit("message.send", { content });
    socket.emit("typing.stop");
    setInputContent("");
  };

  const handleSaveEdit = (messageId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    const socket = connectSocket();
    socket.emit("message.edit", { messageId, content: trimmed });
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleConfirmDelete = (messageId: string) => {
    const socket = connectSocket();
    socket.emit("message.delete", { messageId });
    setDeleteConfirmMessageId(null);
  };

  const handleClearRoom = async () => {
    setClearRoomLoading(true);
    try {
      await clearRoomMessages(roomCode);
      setShowClearRoomConfirm(false);
      // The room.messages.cleared socket event will clear the local list
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clear room messages.");
    } finally {
      setClearRoomLoading(false);
    }
  };

  // ── Public Room Auth Gate: Logged-out visitor prompt ───────────────────────
  if (isPublicRoom && authLoading) {
    return (
      <main className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (isPublicRoom && !user) {
    return (
      <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col items-center justify-center p-4 sm:p-6 page-in">
        <div className="w-full max-w-md my-auto">
          <div className="text-center mb-6 flex flex-col items-center">
            <Link href="/" className="inline-block group mb-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight group-hover:opacity-90 transition-opacity">
                Veil
              </h1>
            </Link>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-cyan-400 w-fit mb-3">
              <LockIcon className="w-3.5 h-3.5 text-[var(--veil-cyan)]" /> Public Space
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">
              Sign up to continue
            </h2>
            <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 leading-relaxed max-w-sm">
              Create your free Veil account to join public conversations.
            </p>
          </div>

          <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4 text-center shadow-2xl">
            <Link
              href={`/login?next=${encodeURIComponent(`/room/${roomCode.toLowerCase()}`)}`}
              className="w-full py-3.5 px-4 rounded-full bg-cyan-400 text-black font-bold text-sm hover:bg-cyan-300 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]"
            >
              Continue with Email
            </Link>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-white/8" />
              <span className="absolute bg-[#111113] px-3 text-xs text-[var(--veil-text-muted)]">
                or
              </span>
            </div>

            <div className="text-xs text-[var(--veil-text-muted)] pt-1">
              Already have an account?{" "}
              <Link
                href={`/login?mode=signin&next=${encodeURIComponent(`/room/${roomCode.toLowerCase()}`)}`}
                className="text-[var(--veil-cyan)] font-semibold hover:underline"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs text-[var(--veil-text-dim)] hover:text-white transition-colors py-1"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--veil-text-muted)]">
          <Spinner />
          <p className="text-sm font-medium">Entering room...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-[100dvh] bg-[var(--veil-bg)] flex flex-col justify-between w-full md:max-w-2xl lg:max-w-3xl md:mx-auto md:border-x md:border-[var(--veil-border)]/40 md:shadow-2xl overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-[var(--veil-border)] bg-[var(--veil-surface)]/90 backdrop-blur-md z-20 flex-shrink-0 w-full">
        <Link
          href="/"
          className="text-[var(--veil-text-muted)] hover:text-white transition-colors p-1.5 -ml-1.5"
          title="Exit Room"
        >
          <EyeSlashIcon className="w-6 h-6 text-[var(--veil-cyan)]" />
        </Link>

        <div className="text-center min-w-0 px-2 flex-1">
          <h1 className="font-bold text-base sm:text-lg text-white leading-tight truncate max-w-[180px] xs:max-w-[240px] sm:max-w-[340px] mx-auto">
            {roomName}
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[var(--veil-cyan)] animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold text-[var(--veil-cyan)] truncate">
              {onlineCount} {onlineCount === 1 ? "Person" : "People"} Online ({roomCode})
            </span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab(activeTab === "chat" ? "people" : "chat")}
          className={`p-2 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
            activeTab === "people"
              ? "text-[var(--veil-cyan)] bg-[var(--veil-cyan)]/10"
              : "text-[var(--veil-text-muted)] hover:text-white"
          }`}
          title="Toggle People Panel"
        >
          <PeopleIcon className="w-6 h-6" />
        </button>
      </header>

      {error && (
        <div className="px-3.5 sm:px-5 pt-3 flex-shrink-0 w-full">
          <Toast message={error} type="error" />
        </div>
      )}

      {/* ── Main View Area ──────────────────────────────────────────────── */}
      {activeTab === "people" ? (
        /* ── People / Members Panel ──────────────────────────────────── */
        <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto page-in w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--veil-text-muted)]">
              Participants ({members.length})
            </h2>
            <span className="text-xs font-semibold text-[var(--veil-cyan)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} Online
            </span>
          </div>
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[var(--veil-surface)] border border-[var(--veil-border)] gap-2 min-w-0 w-full"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--veil-surface-2)] flex items-center justify-center border border-[var(--veil-border)] text-xs sm:text-sm font-semibold text-[var(--veil-cyan)]">
                    {m.displayName.slice(0, 2)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--veil-surface)] ${
                      m.isOnline ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-white truncate">
                    {m.displayName} {m.isCurrentUser && "(You)"}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[var(--veil-text-muted)] flex items-center gap-1.5">
                    {m.isOnline ? (
                      <span className="text-emerald-400/90 font-medium">Online</span>
                    ) : (
                      <span>Offline · {m.status}</span>
                    )}
                  </p>
                </div>
              </div>
              {m.role === "admin" && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--veil-cyan)]/10 text-[var(--veil-cyan)] border border-[var(--veil-cyan)]/30 flex items-center gap-1 flex-shrink-0">
                  <CrownIcon className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
          ))}
          <div className="pt-4 flex flex-col items-center gap-2">
            <Link
              href={`/admin/${roomCode}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--veil-cyan)] hover:underline py-2 px-3"
            >
              <CrownIcon className="w-3.5 h-3.5" /> Switch to Admin View
            </Link>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowClearRoomConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:underline py-2 px-3 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Room
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── Chat Messages Feed ────────────────────────────────────────── */
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-3.5 min-h-0 w-full">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-[var(--veil-text-muted)] text-xs sm:text-sm">
              No messages yet. Send a message to start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const myMember = members.find((m) => m.isCurrentUser);
              const currentMemId = myMembershipId || myMember?.id;
              const isSelf = Boolean(
                (currentMemId && msg.senderId === currentMemId) ||
                (user?.id && ((msg as any).authorId === user.id || msg.senderId === user.id))
              );
              const isEditing = editingMessageId === msg.id;
              const isConfirmingDelete = deleteConfirmMessageId === msg.id;
              const isMenuOpen = activeMenuMessageId === msg.id;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              );

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 msg-in w-full group/msg ${
                    isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isSelf && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-[var(--veil-surface-2)] border border-[var(--veil-border)] flex items-center justify-center text-[var(--veil-text-muted)] text-xs flex-shrink-0 mb-0.5">
                      {(msg as any).avatarUrl ? (
                        <img src={(msg as any).avatarUrl} alt={msg.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <EyeSlashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--veil-text-muted)]" />
                      )}
                    </div>
                  )}

                  {/* Actions menu — own messages: edit + delete. Admin on others: delete only. */}
                  {(isSelf || isAdmin) && !isEditing && !isConfirmingDelete && (
                    <div className={`relative flex-shrink-0 self-center ${isSelf ? "" : "order-first"}`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                        }}
                        className="opacity-70 hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all min-w-[28px] min-h-[28px] flex items-center justify-center"
                        title="Message options"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="4" r="1.5" />
                          <circle cx="10" cy="10" r="1.5" />
                          <circle cx="10" cy="16" r="1.5" />
                        </svg>
                      </button>

                      {isMenuOpen && (
                        <div
                          className={`absolute ${isSelf ? "right-0" : "left-0"} bottom-full mb-1 z-30 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl py-1 min-w-[110px] text-xs page-in`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditContent(msg.content);
                                setActiveMenuMessageId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-white/10 hover:text-[var(--veil-cyan)] flex items-center gap-2 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmMessageId(msg.id);
                              setActiveMenuMessageId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 sm:p-4 space-y-1 min-w-0 break-words ${
                      isSelf
                        ? "bg-[#252525] text-white border border-[#353535] rounded-br-none"
                        : "bg-[var(--veil-surface)] text-white border border-[var(--veil-border)] rounded-bl-none"
                    }`}
                  >
                    {!isSelf && (
                      <p className="text-xs font-bold text-[var(--veil-cyan)] mb-1 truncate">
                        {msg.displayName}
                      </p>
                    )}

                    {isEditing ? (
                      /* Inline Editor */
                      <div className="space-y-2 w-full min-w-[200px] sm:min-w-[280px]" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(msg.id);
                            } else if (e.key === "Escape") {
                              setEditingMessageId(null);
                            }
                          }}
                          rows={2}
                          className="w-full bg-[#161616] text-white text-xs sm:text-sm p-2.5 rounded-xl border border-[var(--veil-cyan)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--veil-cyan)] resize-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg.id)}
                            disabled={!editContent.trim()}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-[var(--veil-cyan)] text-black hover:bg-[var(--veil-cyan)]/80 transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : isConfirmingDelete ? (
                      /* Delete Confirmation */
                      <div className="space-y-2 w-full min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs text-red-300 font-medium">Delete this message?</p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmMessageId(null)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(msg.id)}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Message Content */
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                        {msg.content.split(/(@\w+)/g).map((part, i) =>
                          part.startsWith("@") ? (
                            <span
                              key={i}
                              className="text-[var(--veil-cyan)] font-semibold"
                            >
                              {part}
                            </span>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    )}

                    {!isEditing && !isConfirmingDelete && (
                      <p className="text-[10px] text-[var(--veil-text-muted)] text-right pt-0.5 flex items-center justify-end gap-1">
                        <span>{formattedTime}</span>
                        {msg.isEdited && (
                          <span className="italic opacity-80 text-[var(--veil-cyan)]/90">· Edited</span>
                        )}
                      </p>
                    )}
                  </div>

                  {isSelf && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--veil-cyan)]/20 border border-[var(--veil-cyan)]/40 flex items-center justify-center text-[var(--veil-cyan)] text-[10px] sm:text-xs flex-shrink-0 font-bold mb-0.5">
                      You
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Live Typing Indicator */}
          {typingMembers.size > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[var(--veil-text-muted)]">
                Someone is typing
              </span>
              <span className="flex items-center gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Composer Bottom Bar ─────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 bg-[var(--veil-surface)] border-t border-[var(--veil-border)] backdrop-blur-md flex-shrink-0 w-full">
        <form onSubmit={handleSend} className="flex items-center gap-2 sm:gap-3 w-full">
          <div className="relative flex-1 flex items-center min-w-0 w-full">
            <button
              type="button"
              className="absolute left-3 text-[var(--veil-text-muted)] hover:text-white transition-colors p-1"
              title="Add attachment"
            >
              <PlusCircleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={inputContent}
              onChange={handleInputChange}
              className="w-full bg-[var(--veil-surface-2)] border border-[var(--veil-border)] rounded-full pl-10 sm:pl-12 pr-12 sm:pr-14 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-[var(--veil-cyan)] transition-colors placeholder:text-[var(--veil-text-muted)] min-h-[46px]"
            />
            <button
              type="submit"
              disabled={!inputContent.trim()}
              className="absolute right-1.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--veil-cyan)] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all touch-manipulation flex-shrink-0"
              title="Send message"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* ── Bottom Nav ───────────────────────────────────────────────────── */}
      <nav className="bottom-nav flex items-center justify-around py-2.5 px-3 border-t border-[var(--veil-border)] bg-[var(--veil-surface)] flex-shrink-0 w-full">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors min-h-[44px] justify-center ${
            activeTab === "chat"
              ? "text-[var(--veil-cyan)] bg-[var(--veil-cyan)]/10"
              : "text-[var(--veil-text-muted)] hover:text-white"
          }`}
        >
          <ChatIcon className="w-5 h-5" />
          <span className="text-xs font-medium">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab("people")}
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors min-h-[44px] justify-center ${
            activeTab === "people"
              ? "text-[var(--veil-cyan)] bg-[var(--veil-cyan)]/10"
              : "text-[var(--veil-text-muted)] hover:text-white"
          }`}
        >
          <PeopleIcon className="w-5 h-5" />
          <span className="text-xs font-medium">People</span>
        </button>

        <Link
          href="/"
          className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-[var(--veil-text-muted)] hover:text-white transition-colors min-h-[44px] justify-center"
        >
          <DoorIcon className="w-5 h-5" />
          <span className="text-xs font-medium">Exit</span>
        </Link>
        </nav>
      </div>

      {/* ── Clear Room Confirmation Modal ─────────────────────────────────── */}
      {showClearRoomConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => !clearRoomLoading && setShowClearRoomConfirm(false)}
        >
          <div
            className="bg-[var(--veil-surface)] border border-[var(--veil-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-2">Clear this room?</h2>
            <p className="text-sm text-[var(--veil-text-muted)] mb-6 leading-relaxed">
              All messages in this public room will be permanently deleted.
              The room will remain active and users can immediately continue chatting.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={clearRoomLoading}
                onClick={() => setShowClearRoomConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--veil-border)] text-sm font-semibold text-[var(--veil-text-muted)] hover:text-white hover:border-white/40 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearRoomLoading}
                onClick={handleClearRoom}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {clearRoomLoading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Room
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
