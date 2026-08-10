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
  Toast,
  Spinner,
} from "@/components/ui";
import {
  getRoom,
  getMessages,
  getMembers,
  MemberViewItem,
  MessageItem as ApiMessageItem,
  ApiError,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";

export default function RoomChatPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("Loading room...");
  const [activeTab, setActiveTab] = useState<"chat" | "people">("chat");
  const [inputContent, setInputContent] = useState("");

  const [members, setMembers] = useState<MemberViewItem[]>([]);
  const [messages, setMessages] = useState<ApiMessageItem[]>([]);
  const [typingMembers, setTypingMembers] = useState<Set<string>>(new Set());
  const [myMembershipId, setMyMembershipId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load initial data and connect Socket.IO
  useEffect(() => {
    let isSubscribed = true;
    const socket = connectSocket();

    async function initRoom() {
      try {
        setLoading(true);

        const [roomRes, messagesRes, membersRes] = await Promise.all([
          getRoom(roomCode),
          getMessages(roomCode),
          getMembers(roomCode),
        ]);

        if (!isSubscribed) return;

        setRoomName(roomRes.room.name);
        setMyMembershipId(roomRes.membership.id);
        setMessages(messagesRes.messages);
        setMembers(membersRes.members);

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
    }) => {
      if (data.membership) setMyMembershipId(data.membership.id);
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
    socket.on("room.join.failed", handleJoinFailed);
    socket.on("message.created", handleMessageCreated);
    socket.on("message.rejected", handleMessageRejected);
    socket.on("identity.revealed", handleIdentityRevealed);
    socket.on("identity.hidden", handleIdentityHidden);
    socket.on("member.joined", handleMemberJoined);
    socket.on("member.left", handleMemberLeft);
    socket.on("member.muted", handleMemberMuted);
    socket.on("member.removed", handleMemberRemoved);
    socket.on("member.banned", handleMemberRemoved);
    socket.on("room.closed", handleRoomClosed);
    socket.on("typing.start", handleTypingStart);
    socket.on("typing.stop", handleTypingStop);

    return () => {
      isSubscribed = false;
      socket.emit("room.leave");
      socket.off("room.joined", handleJoined);
      socket.off("room.join.failed", handleJoinFailed);
      socket.off("message.created", handleMessageCreated);
      socket.off("message.rejected", handleMessageRejected);
      socket.off("identity.revealed", handleIdentityRevealed);
      socket.off("identity.hidden", handleIdentityHidden);
      socket.off("member.joined", handleMemberJoined);
      socket.off("member.left", handleMemberLeft);
      socket.off("member.muted", handleMemberMuted);
      socket.off("member.removed", handleMemberRemoved);
      socket.off("member.banned", handleMemberRemoved);
      socket.off("room.closed", handleRoomClosed);
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
    <div className="min-h-dvh bg-[var(--veil-bg)] flex flex-col justify-between max-w-lg mx-auto border-x border-[var(--veil-border)]/40 shadow-2xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--veil-border)] bg-[var(--veil-surface)]/80 backdrop-blur-md sticky top-0 z-20">
        <Link
          href="/"
          className="text-[var(--veil-text-muted)] hover:text-white transition-colors"
          title="Exit Room"
        >
          <EyeSlashIcon className="w-6 h-6 text-[var(--veil-cyan)]" />
        </Link>

        <div className="text-center">
          <h1 className="font-bold text-lg text-white leading-tight">
            {roomName}
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[var(--veil-cyan)] animate-pulse" />
            <span className="text-xs font-semibold text-[var(--veil-cyan)]">
              {members.length} Online ({roomCode})
            </span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab(activeTab === "chat" ? "people" : "chat")}
          className={`p-1.5 rounded-lg transition-colors ${
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
        <div className="p-4">
          <Toast message={error} type="error" />
        </div>
      )}

      {/* ── Main View Area ──────────────────────────────────────────────── */}
      {activeTab === "people" ? (
        /* ── People / Members Panel ──────────────────────────────────── */
        <div className="flex-1 p-5 space-y-3 overflow-y-auto page-in">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--veil-text-muted)] mb-3">
            Active Room Participants ({members.length})
          </h2>
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--veil-surface)] border border-[var(--veil-border)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--veil-surface-2)] flex items-center justify-center border border-[var(--veil-border)] text-sm font-semibold text-[var(--veil-cyan)]">
                  {m.displayName.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {m.displayName} {m.isCurrentUser && "(You)"}
                  </p>
                  <p className="text-xs text-[var(--veil-text-muted)]">
                    Status: {m.status}
                  </p>
                </div>
              </div>
              {m.role === "admin" && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--veil-cyan)]/10 text-[var(--veil-cyan)] border border-[var(--veil-cyan)]/30 flex items-center gap-1">
                  <CrownIcon className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
          ))}
          <div className="pt-4 text-center">
            <Link
              href={`/admin/${roomCode}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--veil-cyan)] hover:underline"
            >
              <CrownIcon className="w-3.5 h-3.5" /> Switch to Admin View
            </Link>
          </div>
        </div>
      ) : (
        /* ── Chat Messages Feed ────────────────────────────────────────── */
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-[var(--veil-text-muted)] text-sm">
              No messages yet. Send a message to start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.senderId === myMembershipId;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              );

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 msg-in ${
                    isSelf ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isSelf && (
                    <div className="w-8 h-8 rounded-full bg-[var(--veil-surface-2)] border border-[var(--veil-border)] flex items-center justify-center text-[var(--veil-text-muted)] text-xs flex-shrink-0">
                      <EyeSlashIcon className="w-4 h-4 text-[var(--veil-text-muted)]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[78%] rounded-2xl p-4 space-y-1 ${
                      isSelf
                        ? "bg-[#252525] text-white border border-[#353535] rounded-br-none"
                        : "bg-[var(--veil-surface)] text-white border border-[var(--veil-border)] rounded-bl-none"
                    }`}
                  >
                    {!isSelf && (
                      <p className="text-xs font-bold text-[var(--veil-cyan)] mb-1">
                        {msg.displayName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
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

                    <p className="text-[10px] text-[var(--veil-text-muted)] text-right pt-0.5">
                      {formattedTime}
                    </p>
                  </div>

                  {isSelf && (
                    <div className="w-8 h-8 rounded-full bg-[var(--veil-cyan)]/20 border border-[var(--veil-cyan)]/40 flex items-center justify-center text-[var(--veil-cyan)] text-xs flex-shrink-0 font-bold">
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
      <div className="p-4 bg-[var(--veil-surface)]/90 border-t border-[var(--veil-border)] backdrop-blur-md">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <div className="relative flex-1 flex items-center">
            <button
              type="button"
              className="absolute left-3.5 text-[var(--veil-text-muted)] hover:text-white transition-colors"
              title="Add attachment"
            >
              <PlusCircleIcon className="w-6 h-6" />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={inputContent}
              onChange={handleInputChange}
              className="w-full bg-[var(--veil-surface-2)] border border-[var(--veil-border)] rounded-full pl-12 pr-14 py-3 text-sm text-white focus:outline-none focus:border-[var(--veil-cyan)] transition-colors placeholder:text-[var(--veil-text-muted)]"
            />
            <button
              type="submit"
              disabled={!inputContent.trim()}
              className="absolute right-2 w-10 h-10 rounded-full bg-[var(--veil-cyan)] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all"
              title="Send message"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* ── Bottom Nav ───────────────────────────────────────────────────── */}
      <nav className="bottom-nav flex items-center justify-around py-3 px-4 border-t border-[var(--veil-border)] bg-[var(--veil-surface)]">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
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
          className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
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
          className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl text-[var(--veil-text-muted)] hover:text-white transition-colors"
        >
          <DoorIcon className="w-5 h-5" />
          <span className="text-xs font-medium">Exit</span>
        </Link>
      </nav>
    </div>
  );
}
