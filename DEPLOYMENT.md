# VEIL — DEPLOYMENT.md

## 1. Purpose

This document defines how Veil is developed, tested, and deployed.

Veil must initially support two deployment environments:

```text
LOCAL
Production-like development environment on the developer's PC

FREE PRODUCTION
Publicly accessible deployment using free-tier services
```

The architecture must remain easy to migrate to paid infrastructure later.

---

# 2. Deployment Philosophy

Veil is currently a small project.

Do NOT introduce unnecessary infrastructure.

Avoid initially:

```text
Kubernetes
Docker Swarm
Microservice architecture
Dedicated Redis cluster
Dedicated message broker
Multiple backend servers
Complex CI/CD infrastructure
```

The initial goal is:

```text
Simple
Reliable
Free
Easy to debug
Easy to deploy
Easy to migrate later
```

---

# 3. Initial Architecture

Recommended production architecture:

```text
                    INTERNET
                       │
                       ▼
              ┌─────────────────┐
              │    Frontend     │
              │    Next.js      │
              └────────┬────────┘
                       │
                       │ HTTPS
                       ▼
              ┌─────────────────┐
              │     Backend     │
              │ Node.js /       │
              │ Socket.IO       │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │   Free Tier     │
              └─────────────────┘
```

Redis is NOT required for the first deployment.

---

# 4. Recommended Free Deployment Stack

Use services with free tiers where available.

Suggested architecture:

```text
Frontend
Next.js
↓
Vercel

Backend
Node.js + Socket.IO
↓
A free-tier Node hosting provider

Database
PostgreSQL
↓
Supabase

Repository
GitHub
```

The exact hosting provider for the backend can change.

The application must NOT become tightly coupled to a specific provider.

---

# 5. Important Free-Tier Limitation

Free hosting may have:

* sleep/cold starts
* CPU limits
* RAM limits
* bandwidth limits
* connection limits
* temporary service restrictions

Therefore:

> Free deployment is suitable for Veil's early stage and friend-group usage, not guaranteed high-scale production traffic.

The application architecture should still follow production security practices.

---

# 6. Local Development

Local development should support:

```text
Frontend
Backend
PostgreSQL
```

Recommended local architecture:

```text
Browser
   │
   ├──────────────► Next.js
   │
   └──────────────► Node.js + Socket.IO
                          │
                          ▼
                     PostgreSQL
```

---

# 7. Local Ports

Suggested defaults:

```text
Frontend:
http://localhost:3000

Backend:
http://localhost:4000

PostgreSQL:
localhost:5432
```

These values must be configurable through environment variables.

Do not hard-code them throughout the application.

---

# 8. Local Database

Development can use either:

```text
Option A:
Local PostgreSQL

Option B:
Supabase development database
```

Recommended:

```text
Local PostgreSQL
```

when offline development is important.

Supabase can be used when testing the production-like environment.

---

# 9. Environment Separation

Maintain separate environments:

```text
.env.local
.env.example
production environment variables
```

Never commit:

```text
.env.local
```

to Git.

---

# 10. Environment Variables

Frontend variables:

```text
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL
```

Backend variables:

```text
NODE_ENV
PORT

DATABASE_URL

SESSION_SECRET

CORS_ORIGIN
```

Additional variables may be added later.

---

# 11. Secret Rules

Never commit:

```text
DATABASE_URL
SESSION_SECRET
Admin Keys
Room passwords
API keys
private tokens
```

to Git.

Never place server secrets inside:

```text
NEXT_PUBLIC_*
```

variables.

Anything beginning with:

```text
NEXT_PUBLIC_
```

should be considered publicly visible.

---

# 12. .env.example

The repository must contain:

```text
.env.example
```

Example:

```text
NODE_ENV=development
PORT=4000

DATABASE_URL=

SESSION_SECRET=

CORS_ORIGIN=http://localhost:3000

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Do not put real credentials in this file.

---

# 13. Production Environment Variables

Production values must be configured through the hosting provider's secret/environment-variable system.

Never upload a production `.env` file into the repository.

---

# 14. Git Repository

The project should be maintained in Git.

Recommended structure:

```text
veil/
├── apps/
│   ├── web/
│   └── server/
│
├── packages/
│   ├── shared/
│   └── config/
│
├── docs/
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

If the actual project structure differs, preserve the same architectural separation.

---

# 15. Git Branches

For the initial project:

```text
main
```

is sufficient.

Optional future structure:

```text
main
develop
feature/*
```

Do not create a complicated Git workflow unnecessarily.

---

# 16. Production Build

Before deployment:

```text
Install dependencies
        ↓
Type check
        ↓
Lint
        ↓
Run tests
        ↓
Build frontend
        ↓
Build backend
        ↓
Run database migrations
        ↓
Start production services
```

A deployment should fail if critical build/type checks fail.

---

# 17. Frontend Deployment

The Next.js frontend should be deployed separately from the backend when using the recommended architecture.

Example:

```text
GitHub
   ↓
Vercel
   ↓
Next.js
```

Production frontend:

```text
https://your-domain.example
```

The exact domain can be changed later.

---

# 18. Backend Deployment

The Node.js backend should be deployed to a platform that supports:

```text
Node.js
HTTP
WebSockets / Socket.IO
Environment variables
Long-lived connections
```

This requirement is important.

Do NOT select a backend platform solely because it can run an HTTP API.

Veil requires persistent Socket.IO connections.

---

# 19. Backend Health Endpoint

The backend must expose:

```text
GET /health
```

Example response:

```json
{
  "status": "ok"
}
```

This endpoint should NOT expose:

```text
database credentials
environment variables
server secrets
user information
```

---

# 20. Database Deployment

Use managed PostgreSQL for production.

Supabase PostgreSQL is suitable for the initial free deployment.

Production architecture:

```text
Node.js Backend
       │
       ▼
Supabase PostgreSQL
```

The backend communicates with PostgreSQL.

The frontend should not directly modify security-sensitive database records.

---

# 21. Database Migrations

Database schema changes must be tracked through migrations.

Never manually modify production tables without recording the change.

Example:

```text
migration_001_initial_schema
migration_002_add_reports
migration_003_add_moderation
```

Migration history must be committed to Git.

---

# 22. Production Database Rules

Before applying migrations:

```text
Backup if possible
 ↓
Run migration
 ↓
Verify schema
 ↓
Run health checks
```

Never delete production data as part of a normal deployment.

---

# 23. Database Connection Security

Production PostgreSQL credentials must:

* use TLS/SSL where provided
* remain server-side
* never be exposed to the browser
* never be committed to Git

The frontend must never receive:

```text
DATABASE_URL
```

---

# 24. CORS

Production backend must only allow the intended frontend origin.

Development:

```text
http://localhost:3000
```

Production:

```text
https://your-production-domain
```

Do not use:

```text
*
```

for authenticated production APIs unless there is a specific reason.

---

# 25. HTTPS

Production must use HTTPS.

Do not deploy Veil publicly over plain HTTP.

HTTPS protects:

```text
authentication cookies
session information
room credentials
messages
admin actions
WebSocket communication
```

---

# 26. WebSocket Production Configuration

The production frontend must connect to the production backend URL.

Example:

```text
NEXT_PUBLIC_SOCKET_URL=https://api.example.com
```

Socket.IO should use:

```text
wss
```

through the secure HTTPS connection.

Do not hard-code localhost URLs in production.

---

# 27. Cookie Configuration

If authentication uses cookies, production cookies should use appropriate security settings:

```text
Secure
HttpOnly
SameSite
```

The exact SameSite configuration must match the frontend/backend deployment architecture.

Do not expose session tokens to JavaScript unnecessarily.

---

# 28. Local Authentication

Local development may use:

```text
http://localhost
```

but production authentication must use:

```text
HTTPS
+
secure cookies
```

Do not weaken production security to solve a local development problem.

---

# 29. Database Seed

Optional development seed data may be provided.

Example:

```text
npm run db:seed
```

Seed data may create:

```text
test room
test members
test messages
```

Never run development seed scripts against production automatically.

---

# 30. Local Start Commands

The project should provide simple commands.

Example:

```text
npm install
```

Then:

```text
npm run dev
```

This should start the required development services where practical.

If separate processes are required:

```text
npm run dev:web
npm run dev:server
```

Document the exact commands in the README.

---

# 31. Production Start

The backend must have a production start command.

Example:

```text
npm run start
```

The frontend should use its platform's recommended Next.js production deployment process.

Do not run development servers in production.

Avoid:

```text
next dev
nodemon
development watchers
```

in production.

---

# 32. Build Configuration

Production builds must use:

```text
NODE_ENV=production
```

Do not depend on development-only packages or development behavior.

---

# 33. Free Production Architecture

Initial free deployment should look like:

```text
                 USERS
                   │
                   ▼
             ┌───────────┐
             │  Vercel   │
             │ Next.js   │
             └─────┬─────┘
                   │
              HTTPS/WSS
                   │
                   ▼
             ┌───────────┐
             │ Backend   │
             │ Node.js   │
             │ Socket.IO │
             └─────┬─────┘
                   │
                   ▼
             ┌───────────┐
             │ Supabase  │
             │ PostgreSQL│
             └───────────┘
```

This is enough for the initial Veil release.

---

# 34. Why Redis Is Not Required Yet

The current architecture uses:

```text
Node.js
+
Socket.IO
+
PostgreSQL
```

Redis is unnecessary for a single backend instance.

Introduce Redis only when:

```text
multiple backend instances
```

are required.

Then:

```text
Load Balancer
      │
 ┌────┼────┐
 ▼    ▼    ▼
API  API  API
 │    │    │
 └────┼────┘
      ▼
    Redis
```

can synchronize Socket.IO events.

---

# 35. Scaling Path

Veil should be able to evolve:

### Stage 1

```text
Free
Single backend
PostgreSQL
Socket.IO
```

### Stage 2

```text
Paid backend
More CPU/RAM
PostgreSQL scaling
Redis
```

### Stage 3

```text
Multiple backend instances
Load balancing
Redis adapter
Database optimization
Observability
```

### Stage 4

```text
Dedicated infrastructure
Autoscaling
CDN
Advanced monitoring
Automated backups
```

Do not build Stage 4 infrastructure during Stage 1.

---

# 36. Deployment Checklist

Before every production deployment:

```text
[ ] Git working tree clean
[ ] Environment variables configured
[ ] Secrets not committed
[ ] TypeScript passes
[ ] Lint passes
[ ] Tests pass
[ ] Frontend builds
[ ] Backend builds
[ ] Database migration reviewed
[ ] CORS configured
[ ] HTTPS configured
[ ] Socket.IO production URL configured
[ ] Health endpoint works
[ ] Database connection works
[ ] Authentication works
[ ] Member join works
[ ] Admin join works
[ ] Create room works
[ ] Chat works
[ ] Identity reveal works
[ ] Identity hide works
[ ] Moderation works
[ ] Reconnection works
```

---

# 37. Post-Deployment Smoke Test

After deployment, manually test:

```text
1. Open landing page
2. Create a room
3. Save Admin Key
4. Join as member
5. Join as admin
6. Send messages
7. Verify anonymity
8. Reveal a member
9. Verify reveal propagates
10. Hide identity
11. Verify anonymity returns
12. Test mute
13. Test remove
14. Test ban
15. Disconnect/reconnect
16. Verify messages synchronize
```

---

# 38. Rollback

If a deployment breaks production:

```text
Identify failure
      ↓
Stop further deployment
      ↓
Rollback application version
      ↓
Verify health endpoint
      ↓
Verify database compatibility
      ↓
Run smoke test
```

Database migrations require extra care.

Never automatically roll back destructive database migrations.

---

# 39. Logging

Production logs should contain useful operational information.

Examples:

```text
Server started
Database connected
Socket connection failure
Authentication failure
Room join failure
Unhandled server error
Database error
```

Do NOT log:

```text
passwords
Admin Keys
session tokens
message content
private identities
DATABASE_URL
```

---

# 40. Monitoring

Initial monitoring can remain simple.

Monitor:

```text
Backend health
Database connectivity
HTTP errors
Socket connection errors
Memory usage
CPU usage
```

Later add:

```text
error tracking
metrics
distributed tracing
uptime monitoring
```

---

# 41. Backups

Production database data should eventually have automated backups.

For the initial free deployment:

* understand the database provider's backup/retention policy
* do not assume free-tier data is permanently recoverable
* export important test/demo data when necessary

Before Veil becomes a serious public service, establish a proper backup strategy.

---

# 42. Domain

A custom domain is optional initially.

Free deployment can use provider-generated domains.

Example:

```text
Frontend:
provider-generated-domain

Backend:
provider-generated-domain
```

A custom domain can be introduced later.

---

# 43. Local HTTPS

Local development does not require HTTPS for the initial implementation.

Use:

```text
http://localhost
```

unless a feature specifically requires secure-context behavior.

Production must use HTTPS.

---

# 44. Local Testing Across Devices

If testing Veil from a phone on the same Wi-Fi network, localhost on the phone refers to the phone itself.

Use the development machine's local network address when necessary.

Example:

```text
http://192.168.x.x:3000
```

The backend CORS configuration must allow the development device when performing this type of testing.

Do NOT add arbitrary public origins to production CORS.

---

# 45. Production Security Reminder

Free hosting does NOT mean relaxed security.

The following remain mandatory:

```text
Authentication
Authorization
HTTPS
Secure cookies
Input validation
Rate limiting
Database security
Admin Key protection
Server-side permission checks
Safe WebSocket handling
```

---

# 46. Cost Philosophy

Initial target:

```text
₹0 infrastructure cost
```

where free tiers are sufficient.

Do not optimize the application around avoiding all future costs.

Instead:

> Build the architecture so that paying for more resources later is a configuration/infrastructure change rather than a complete rewrite.

---

# 47. When to Start Paying

Consider paid infrastructure when Veil experiences:

```text
frequent cold starts
resource exhaustion
high concurrent connections
database limits
bandwidth limits
unacceptable latency
reliability requirements
```

Do not pay for infrastructure simply because the application exists.

---

# 48. Production Environment Principle

Local:

```text
Cheap
Flexible
Debuggable
```

Production:

```text
Secure
Stable
Observable
Recoverable
```

Free production infrastructure is acceptable for Veil's initial stage as long as the application itself follows production-grade engineering practices.

---

# 49. Final Deployment Principle

The initial Veil deployment should remain:

```text
NEXT.JS
   +
NODE.JS
   +
SOCKET.IO
   +
POSTGRESQL
```

with:

```text
GitHub
+
Free frontend hosting
+
Free backend hosting supporting WebSockets
+
Supabase PostgreSQL
```

No unnecessary infrastructure.

The objective is:

> **Get Veil running reliably for real users at ₹0, while keeping the architecture ready to scale when the project grows.**
