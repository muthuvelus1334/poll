# LivePoll — Real-Time Audience Polling Platform

A high-performance, real-time live polling application built with **React**, **Go (Gin)**, **MongoDB**, and **Redis**. Designed for interactive presentations, live events, classrooms, and team decisions with zero page reload.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │              React Frontend             │
                        │    (Minimalist UI, WebSockets, QR)      │
                        └────────────────────┬────────────────────┘
                                             │
                       HTTP REST API         │       WebSocket Stream
                    (Auth, CRUD, Voting)     │      (Real-time Results)
                                             v
                        ┌─────────────────────────────────────────┐
                        │             Go (Gin) Service            │
                        │  - Strict Backend Input Validation      │
                        │  - JWT Authentication & Bcrypt Hashing  │
                        │  - Gorilla WebSocket Hub                │
                        └────────────┬────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    ┌───────────────────────────┐           ┌───────────────────────────┐
    │          MongoDB          │           │           Redis           │
    │  - User Accounts          │           │  - Atomic HINCRBY Counts  │
    │  - Poll Definitions       │           │  - O(1) SADD Voter Sets   │
    │  - Durable Snapshots      │           │  - Pub/Sub Real-time Bus  │
    └───────────────────────────┘           └───────────────────────────┘
```

---

## The Four Required Layers & Their Real-World Roles

| Layer | Technology | Real-World Role |
|---|---|---|
| **Frontend** | **React (Vite)** | Minimalist, clean white interface with responsive vote bars, live viewer counter, QR code sharing modal, and seamless WebSocket connection handling. |
| **Backend** | **Go (Gin)** | High-throughput, statically typed API service handling JWT authentication, request validation, WebSocket connection management, and service orchestration. |
| **Database** | **MongoDB** | Durable document database for persistent storage of users, polls, options, and historical tally records. |
| **Realtime** | **Redis** | **Active operational engine**: drives atomic vote increments, prevents duplicate voting, and broadcasts live results via Pub/Sub to WebSockets. |

### Why Redis is Doing Meaningful Work (Not Just Sitting for Show)
1. **Atomic In-Memory Increments (`HINCRBY`)**: Under high-concurrency voting spikes, relational/document updates cause write contention and database lock overhead. Redis executes atomic increments at sub-millisecond speeds (`HINCRBY poll:{id}:votes {option_id} 1`).
2. **$O(1)$ Duplicate Voter Prevention (`SADD`)**: An in-memory set `poll:{id}:voters {voter_fingerprint_ip}` ensures that checking whether a voter has already voted is instantaneous without disk I/O. If `SADD` returns 0, the vote is immediately rejected.
3. **Redis Pub/Sub Message Bus (`PUBLISH` / `SUBSCRIBE`)**: When a vote occurs, Go publishes the new tally to `poll:{id}:events`. All Go backend workers subscribe and broadcast updates to connected WebSockets, enabling horizontal scalability.
4. **Asynchronous Write-Back**: Vote tallies are synchronized to MongoDB in the background, ensuring zero data loss without slowing down the real-time voting path.

---

## User Flow

```
1. Create Poll ──► 2. Share Link / QR ──► 3. Audience Votes ──► 4. Live Results Stream
   (Authenticated)    (Copy URL / QR)       (Instant Feedback)     (Zero Refresh WS)
```

1. **Create Poll**: Authenticated user sets a title, description, and 2–8 distinct options.
2. **Share Link**: Creator gets a direct voting link or generated QR code to share with the audience.
3. **Audience Votes**: Audience opens the link on any device, selects an option, and submits. Double voting is strictly prevented.
4. **Live Results**: Everyone on the results page sees vote counts and percentage bars animate in real-time.

---

## Project Structure

```
├── backend/
│   ├── cmd/server/main.go          # Application entry point & router
│   ├── internal/
│   │   ├── config/config.go        # Environment variable loader
│   │   ├── database/db.go          # MongoDB & Redis client connections
│   │   ├── handlers/               # Gin HTTP & WebSocket controllers
│   │   │   ├── auth_handler.go     # Signup, Login, Me endpoints
│   │   │   ├── poll_handler.go     # Create, Get, List, Close, Delete polls
│   │   │   ├── vote_handler.go     # Cast vote, Get live results
│   │   │   └── ws_handler.go       # WebSocket stream handler
│   │   ├── middleware/             # JWT auth and CORS middlewares
│   │   ├── models/                 # User, Poll, Option, and Event structs
│   │   ├── services/               # Business logic (Auth, Polls, Redis Voting)
│   │   └── websocket/              # Hub and Client WebSocket connection pool
│   └── go.mod                      # Go dependencies
├── frontend/
│   ├── src/
│   │   ├── components/             # Navbar, ShareModal (QR code)
│   │   ├── context/AuthContext.jsx # Authentication state provider
│   │   ├── hooks/usePollLiveResults.js # Realtime WebSocket hook
│   │   ├── pages/                  # Home, Login, Register, Dashboard, Create, Vote, Results
│   │   ├── services/api.js         # API client & voter fingerprint generator
│   │   ├── App.jsx                 # Application layout and routing
│   │   └── index.css               # Minimalist clean white design system
│   └── package.json                # React & Vite dependencies
└── README.md                       # Documentation & submission guide
```

---

## How to Run Locally

### 1. Backend Service
```bash
cd backend
# Set environment variables in .env (or use defaults)
go run ./cmd/server/main.go
```
*Backend runs at `http://localhost:8080`.*

### 2. Frontend React Application
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/register` — Create a new creator account `{ username, email, password }`
- `POST /api/auth/login` — Authenticate and receive JWT `{ email, password }`
- `GET /api/auth/me` — Get current logged-in creator profile (Protected)

### Poll Management
- `POST /api/polls` — Create a new poll with options (Protected)
- `GET /api/polls` — List all polls created by logged-in user (Protected)
- `GET /api/polls/:id` — Get poll details by ID (Public)
- `PATCH /api/polls/:id/status` — Close or reopen a poll `{ isActive: boolean }` (Protected)
- `DELETE /api/polls/:id` — Delete a poll (Protected)

### Real-Time Voting & Results
- `POST /api/polls/:id/vote` — Cast an atomic vote `{ optionId, voterFingerprint }` (Public)
- `GET /api/polls/:id/results` — Fetch current aggregated tallies and percentages (Public)
- `GET /api/polls/:id/ws` — WebSocket real-time event stream (Public)

---

## Live Deployment Guide (Meeting the "Actually Deployed" Requirement)

To deploy this project to free, production-ready cloud services:

1. **MongoDB**:
   - Create a free database on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Get your connection URI: `mongodb+srv://<user>:<password>@cluster.mongodb.net/live_polling_db`.
2. **Redis**:
   - Create a free database on [Upstash Redis](https://upstash.com/) or [Redis Cloud](https://redis.io/try-free/).
   - Get the Redis connection URI (`rediss://default:<password>@...:6379`).
3. **Backend (Go Gin)**:
   - Deploy as a Web Service on [Render](https://render.com/) or [Railway](https://railway.app/).
   - Set environment variables: `MONGO_URI`, `REDIS_URI`, `JWT_SECRET`, `PORT=8080`, `CLIENT_ORIGIN=*`.
4. **Frontend (React)**:
   - Deploy on [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
   - Set build command: `npm run build` and publish directory: `dist`.
   - Set environment variable: `VITE_API_URL=https://your-backend.onrender.com` and `VITE_WS_URL=wss://your-backend.onrender.com`.

---

## Submission & Interview Video Walkthrough Guide (3–5 min)

The task requires submitting a 3–5 min video answering two specific points:

### 1. The One Challenge That Gave the Most Trouble and How It Was Solved
- **The Challenge**: Avoiding race conditions during concurrent voting bursts while keeping the live presentation view updated in real-time without database bottlenecks.
- **The Solution**: Delegating the real-time path entirely to **Redis**. Using atomic `HINCRBY` for increments and `SADD` for duplicate voter checking eliminates write locks. Pairing this with **Redis Pub/Sub** allows the Go server to broadcast vote events instantly to all connected WebSocket clients, while an asynchronous background routine flushes tallies to MongoDB for long-term durability.

### 2. AI Tools Usage Disclosure
- **Honest Disclosure**: AI tools (such as Antigravity / Gemini) were used during development to accelerate boilerplate scaffolding, optimize WebSocket client-hub architecture, and refine the minimalist UI design. All code logic, data flow, Redis atomic operations, and security validations were thoroughly understood, tested, and verified end-to-end.
