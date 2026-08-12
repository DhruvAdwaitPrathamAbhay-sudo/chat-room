# Veil — Ephemeral Anonymous Room Chat

Veil is a lightweight, real-time anonymous chatroom platform designed for high-trust selective disclosure. Users connect in temporary rooms under server-generated anonymous aliases (e.g. *Silent Fox*), while real identity (*Real Name*) remains strictly private to the user and can only be revealed by an authorized Room Admin using selective identity reveal controls.

---

## Key Features

- **Capacity Target**: Optimized for 40–50 simultaneous users per room with real-time Socket.IO chat.
- **Server-Managed Anonymous Identities**: Server-generated unique aliases (e.g. *Silent Fox*, *Quiet Raven*) with zero client collisions.
- **Private Real Names**: Members join using Real Name + Room Name + Room Password. Real names are strictly gated and accessible only to authorized Room Admins.
- **Admin Moderation & Selective Reveal**: Room Admins can reveal member identities, hide them back, mute, or ban members in real-time.
- **Complete Room Destruction**: When all members leave or a Global Admin clears rooms, rooms and ALL associated records (messages, memberships, real names, anonymous identities, moderation history, orphaned user accounts) are permanently deleted from PostgreSQL/Supabase.
- **Global Admin Emergency Cleanup**: Landing page "Clear All Rooms" feature protected by constant-time Global Admin Key verification.

---

## Architecture & Stack

- **Frontend**: Next.js 16 (App Router), React, Vanilla CSS design tokens (glassmorphism & dark mode UI), Socket.IO client, deployed on **Vercel**.
- **Backend**: Node.js, Express, Socket.IO, Argon2 password hashing, TypeScript, deployed on **Render**.
- **Database**: PostgreSQL (Supabase) with transactional cascading deletes.

---

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL instance or Supabase database

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DhruvAdwaitPrathamAbhay-sudo/chat-room.git
   cd chat-room
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```
   Fill in your PostgreSQL `DATABASE_URL`, `SESSION_SECRET`, and `ADMIN_KEYS`.

3. **Install Dependencies**:
   ```bash
   # Install backend dependencies
   cd backend && npm install

   # Install frontend dependencies
   cd ../frontend && npm install
   ```

4. **Run Development Servers**:
   ```bash
   # Terminal 1 — Backend (starts on http://localhost:4000)
   cd backend && npm run dev

   # Terminal 2 — Frontend (starts on http://localhost:3000)
   cd frontend && npm run dev
   ```

---

## Environment Variables Reference

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/veil` |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,https://your-app.vercel.app` |
| `PORT` | Backend server port | `4000` |
| `NODE_ENV` | Environment mode (`development` \| `production`) | `development` |
| `SESSION_SECRET` | Cryptographically random string (min 32 chars) | `32+ character random secret` |
| `ADMIN_KEYS` | Comma-separated Global Admin Keys for room creation & clear-all | `VEIL-KEY1,VEIL-KEY2` |
| `MAX_ROOM_MEMBERS` | Maximum allowed members per room | `50` |
| `ROOM_INACTIVITY_TIMEOUT` | Disconnect grace period in ms before auto-deletion | `30000` |

---

## Production Deployment Guide Summary

### 1. Database (Supabase)
Ensure your Supabase project is active and schema migrations (`backend/src/config/db.ts`) run automatically on backend startup.

### 2. Backend (Render)
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start` (runs `node dist/server.js`)
- Set environment variables (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_KEYS`, `ALLOWED_ORIGINS`, `MAX_ROOM_MEMBERS=50`).

### 3. Frontend (Vercel)
- Root directory: `frontend`
- Framework Preset: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api`

---

## Security & Privacy Compliance

- **Zero Data Retention**: Room deletion destroys all associated chat messages, aliases, real names, and moderation logs.
- **Timing-Safe Admin Checks**: Global Admin Key comparisons use `crypto.timingSafeEqual`.
- **Security Headers & Rate Limiting**: Protected with Helmet headers and rate limiters on creation, joining, and admin actions.
