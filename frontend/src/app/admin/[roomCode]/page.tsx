"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  VeilButton,
  VeilBadge,
  EyeIcon,
  EyeOffIcon,
  CrownIcon,
  MicOffIcon,
  UserMinusIcon,
  ArrowLeftIcon,
  DoorIcon,
  Toast,
  Spinner,
} from "@/components/ui";
import {
  getRoom,
  getMembers,
  MemberViewItem,
  revealIdentity,
  hideIdentity,
  muteMember,
  unmuteMember,
  removeMember,
  closeRoom,
  ApiError,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";

export default function AdminRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [members, setMembers] = useState<MemberViewItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberViewItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load initial members and verify admin role
  useEffect(() => {
    let isSubscribed = true;
    const socket = connectSocket();

    async function loadAdminData() {
      try {
        setLoading(true);
        const [roomRes, membersRes] = await Promise.all([
          getRoom(roomCode),
          getMembers(roomCode),
        ]);

        if (!isSubscribed) return;

        if (roomRes.membership.role !== "admin") {
          setError("Admin access required for this room.");
          setTimeout(() => router.push(`/room/${roomCode}`), 2000);
          return;
        }

        setMembers(membersRes.members);
        if (membersRes.members.length > 0) {
          setSelectedMember(membersRes.members[0]);
        }

        socket.emit("room.join", { roomCode });
      } catch (err) {
        if (!isSubscribed) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load admin controls.");
        }
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadAdminData();

    // Socket Event Listeners
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
      setSelectedMember((prev) =>
        prev && prev.id === data.memberId
          ? { ...prev, displayName: data.displayName, identityVisible: true }
          : prev
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
      setSelectedMember((prev) =>
        prev && prev.id === data.memberId
          ? { ...prev, displayName: data.displayName, identityVisible: false }
          : prev
      );
    };

    const handleMemberJoined = () => {
      getMembers(roomCode).then((res) => setMembers(res.members)).catch(() => {});
    };

    const handleMemberLeft = (data: { memberId: string }) => {
      setMembers((prev) => prev.filter((m) => m.id !== data.memberId));
    };

    socket.on("identity.revealed", handleIdentityRevealed);
    socket.on("identity.hidden", handleIdentityHidden);
    socket.on("member.joined", handleMemberJoined);
    socket.on("member.left", handleMemberLeft);

    return () => {
      isSubscribed = false;
      socket.off("identity.revealed", handleIdentityRevealed);
      socket.off("identity.hidden", handleIdentityHidden);
      socket.off("member.joined", handleMemberJoined);
      socket.off("member.left", handleMemberLeft);
    };
  }, [roomCode, router]);

  // Real API Moderation Actions
  const handleToggleIdentity = async (memberId: string) => {
    if (!selectedMember) return;
    setActionLoading(true);
    try {
      if (selectedMember.identityVisible) {
        await hideIdentity(roomCode, memberId);
        showToast("Identity hidden");
      } else {
        await revealIdentity(roomCode, memberId);
        showToast("Identity revealed");
      }
    } catch (err) {
      if (err instanceof ApiError) showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMute = async (memberId: string) => {
    if (!selectedMember) return;
    setActionLoading(true);
    try {
      if (selectedMember.status === "muted") {
        await unmuteMember(roomCode, memberId);
        showToast("User unmuted");
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, status: "active" } : m))
        );
        setSelectedMember((prev) =>
          prev ? { ...prev, status: "active" } : null
        );
      } else {
        await muteMember(roomCode, memberId);
        showToast("User muted");
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, status: "muted" } : m))
        );
        setSelectedMember((prev) =>
          prev ? { ...prev, status: "muted" } : null
        );
      }
    } catch (err) {
      if (err instanceof ApiError) showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setActionLoading(true);
    try {
      await removeMember(roomCode, memberId);
      showToast("Member removed from room");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSelectedMember(null);
    } catch (err) {
      if (err instanceof ApiError) showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRoom = async () => {
    if (
      !confirm("Are you sure you want to close this room? All members will be disconnected.")
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await closeRoom(roomCode);
      showToast("Room closed successfully.");
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      if (err instanceof ApiError) showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--veil-text-muted)]">
          <Spinner />
          <p className="text-sm font-medium">Loading admin controls...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col justify-between max-w-lg mx-auto border-x border-[var(--veil-border)]/40">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--veil-border)] bg-[var(--veil-surface)]/90 backdrop-blur-md">
        <Link
          href={`/room/${roomCode}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--veil-text-muted)] hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Member View
        </Link>
        <div className="flex items-center gap-2">
          <VeilBadge>
            <CrownIcon className="text-[var(--veil-cyan)]" /> Admin Room ({roomCode})
          </VeilBadge>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="px-5 pt-3">
          <Toast message={toastMessage.text} type={toastMessage.type} />
        </div>
      )}

      {error && (
        <div className="px-5 pt-3">
          <Toast message={error} type="error" />
        </div>
      )}

      {/* ── Active Members List ────────────────────────────────────────── */}
      <div className="flex-1 p-5 space-y-4 overflow-y-auto page-in">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--veil-text-muted)]">
            Active Room Participants ({members.length})
          </h1>
          <span className="text-xs text-[var(--veil-cyan)] font-medium">
            Tap participant to moderate
          </span>
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedMember?.id === member.id
                  ? "bg-[var(--veil-surface-2)] border-[var(--veil-cyan)]/60 shadow-lg"
                  : "bg-[var(--veil-surface)] border-[var(--veil-border)] hover:border-[var(--veil-border)]/80"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[var(--veil-cyan)]/20 to-[var(--veil-surface-2)] border border-[var(--veil-cyan)]/40 flex items-center justify-center font-bold text-white text-sm">
                    {member.displayName.slice(0, 2)}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[var(--veil-cyan)] border-2 border-[var(--veil-surface)]" />
                </div>

                <div>
                  <p className="font-bold text-white text-base">
                    {member.displayName}{" "}
                    {member.realName && member.realName !== member.displayName && (
                      <span className="text-xs text-[var(--veil-text-muted)]">
                        ({member.realName})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--veil-text-muted)]">
                    Role: {member.role} • Status: {member.status}
                  </p>
                </div>
              </div>

              {member.identityVisible && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--veil-cyan)]/10 text-[var(--veil-cyan)] border border-[var(--veil-cyan)]/30 flex items-center gap-1">
                  ✓ Identity revealed
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Admin Action Modal / Bottom Sheet ──────────────────────────── */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[var(--veil-surface)] border-t sm:border border-[var(--veil-border)] rounded-t-3xl sm:rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-[var(--veil-border)] rounded-full mx-auto sm:hidden" />

            <div className="text-center flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--veil-cyan)]/30 to-purple-900/30 border-2 border-[var(--veil-cyan)] shadow-[0_0_20px_rgba(0,229,255,0.25)] flex items-center justify-center text-xl font-extrabold text-white">
                  {selectedMember.displayName.slice(0, 2)}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedMember.displayName}
                </h2>
                {selectedMember.realName && (
                  <p className="text-sm font-semibold text-[var(--veil-cyan)] mt-0.5">
                    Real Name: {selectedMember.realName}
                  </p>
                )}
                <p className="text-xs font-mono text-[var(--veil-text-muted)] mt-1">
                  ID: {selectedMember.id}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <VeilButton
                variant="primary"
                loading={actionLoading}
                onClick={() => handleToggleIdentity(selectedMember.id)}
              >
                {selectedMember.identityVisible ? (
                  <>
                    <EyeOffIcon /> Hide Identity
                  </>
                ) : (
                  <>
                    <EyeIcon /> Reveal Identity
                  </>
                )}
              </VeilButton>

              <div className="grid grid-cols-2 gap-3">
                <VeilButton
                  variant="secondary"
                  loading={actionLoading}
                  onClick={() => handleToggleMute(selectedMember.id)}
                >
                  <MicOffIcon />{" "}
                  {selectedMember.status === "muted" ? "Unmute" : "Mute User"}
                </VeilButton>

                <VeilButton
                  variant="danger"
                  loading={actionLoading}
                  onClick={() => handleRemoveMember(selectedMember.id)}
                >
                  <UserMinusIcon /> Remove
                </VeilButton>
              </div>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Close Action Footer ────────────────────────────────────── */}
      <footer className="p-4 border-t border-[var(--veil-border)] bg-[var(--veil-surface)]/90 backdrop-blur-md">
        <VeilButton
          variant="danger"
          loading={actionLoading}
          onClick={handleCloseRoom}
        >
          <DoorIcon /> Close Room & End Session
        </VeilButton>
      </footer>
    </main>
  );
}
