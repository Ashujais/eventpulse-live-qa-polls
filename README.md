# EventPulse — Real-Time Live Q&A and Polling Platform

> A full-stack, real-time live event engagement platform built for conferences, all-hands, and meetups. Hosts create sessions and launch live polls, audience members join with a short code without an account to submit and upvote questions, and everyone sees live updates via WebSockets with zero page refreshes.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** >= 18.0 (tested on Node v20.18.0)
- **npm** >= 9.0

### 2. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 3. Seed Demo Data
Populate the database with a pre-configured demo host, session, participants, questions with upvotes, and live polls:
```bash
npm run seed
```

### 4. Run the Application
Start both the backend server and frontend development server concurrently:
```bash
npm run dev
```

Or start the production server (serves both API, WebSockets, and built frontend on port 4000):
```bash
npm run build
npm start
```

Open your browser to:
- **Audience & Landing View:** [http://localhost:5173](http://localhost:5173) (or `http://localhost:4000` in production)
- **Host Portal:** [http://localhost:5173/host/login](http://localhost:5173/host/login)
- **Presenter Stage Mode:** [http://localhost:5173/presenter/DEMO26](http://localhost:5173/presenter/DEMO26)

---

## 🔑 Demo Credentials

| Role | Access | Credentials |
| :--- | :--- | :--- |
| **Host Account** | Email / Password | **Email:** `host@eventpulse.io`<br>**Password:** `password123` |
| **Demo Session** | Join Code | **Code:** `DEMO26` |
| **Presenter View** | Big Screen Mode | [http://localhost:5173/presenter/DEMO26](http://localhost:5173/presenter/DEMO26) |

> **Pro-Tip:** The Landing Page features a **"Try DEMO26"** button for 1-click audience entry, and the Host Login page features a **"1-Click Demo Host Login"** button for instant zero-typing evaluation.

---

## 🧪 Automated Tests

The backend includes a comprehensive automated test suite covering all critical business logic, input validation, and server-side constraints.

To execute the test suite:
```bash
npm test
```

### Test Coverage Highlights:
1. **Session Lifecycle & Lookup:** Validates short code lookup, session metadata, and 404 response for invalid codes.
2. **Audience Join Validation:** Enforces non-empty display name and active session check.
3. **Question Submission & Anonymous Support:** Enforces character boundaries (3–500 chars) and validates anonymous author masking.
4. **Server-Side Question Vote Enforcement:** Strictly enforces **one upvote per person per question** on the server; duplicate votes return `409 Conflict` and do not increment counts.
5. **Host Moderation Flow:** Tests marking questions as answered, pinning/spotlighting on stage, and hiding questions from audience while remaining visible to host.
6. **Poll Creation & Options Validation:** Validates single-choice poll options (minimum 2 non-empty choices, max 10).
7. **Server-Side Poll Vote Enforcement:** Strictly enforces **one vote per person per poll** on the server; subsequent votes return `409 Conflict`.
8. **Session Export (CSV & JSON):** Verifies data serialization, RFC 4180 CSV compliance, and HTTP attachment headers for questions and poll results.

---

## 🏗️ Architecture & Main Design Decisions

```
eventpulse-live-qa-polls/
├── server/
│   ├── src/
│   │   ├── controllers/      # REST endpoint handlers & business logic
│   │   │   ├── hostAuthController.ts
│   │   │   ├── sessionController.ts
│   │   │   ├── questionController.ts
│   │   │   ├── pollController.ts
│   │   │   └── exportController.ts
│   │   ├── db/               # SQLite database & transaction manager (sql.js)
│   │   │   └── index.ts
│   │   ├── middleware/       # JWT host auth & error handlers
│   │   ├── routes/           # Express API route mapping
│   │   ├── socket/           # Real-time WebSocket room manager (Socket.IO)
│   │   ├── types/            # TypeScript interfaces
│   │   ├── app.ts            # Express application setup
│   │   ├── index.ts          # Server entry point (HTTP + Socket.IO)
│   │   └── seed.ts           # Demo database seed script
│   └── tests/
│       └── api.test.ts       # 8 automated backend integration tests (Vitest + Supertest)
├── client/
│   ├── src/
│   │   ├── components/       # QuestionCard, PollCard, Modals, Navbar, Toast
│   │   ├── context/          # AuthContext & Session state
│   │   ├── lib/              # API fetch client & Socket.IO client
│   │   ├── pages/            # Landing, Audience, Host Dashboard, Presenter View
│   │   ├── types/            # Frontend TypeScript definitions
│   │   ├── App.tsx           # React Router v7 routes
│   │   └── main.tsx          # DOM mounting
├── .env.example              # Environment variables template
├── package.json              # Root orchestration scripts
└── README.md
```

### 1. Database Model
We utilize **SQLite** (via `sql.js`, an embedded WebAssembly-compiled SQLite engine with synchronous atomic persistence to disk and memory mode for lightning-fast test isolation).

#### Relational Schema:
- **`hosts`**: `id` (PK, UUID), `email` (UNIQUE), `name`, `password_hash` (bcrypt), `created_at`.
- **`sessions`**: `id` (PK, UUID), `code` (UNIQUE, 6-char uppercase alphanumeric, indexed), `title`, `description`, `host_id` (FK -> `hosts`), `is_active`, `allow_anonymous`, `created_at`.
- **`participants`**: `id` (PK, UUID stored in client `localStorage`), `session_id` (FK -> `sessions`), `display_name`, `joined_at`.
- **`questions`**: `id` (PK, UUID), `session_id` (FK -> `sessions`), `participant_id` (FK -> `participants`), `author_name`, `content` (3–500 chars), `is_anonymous` (0/1), `is_answered` (0/1), `is_hidden` (0/1), `is_pinned` (0/1), `upvotes_count`, `created_at`.
- **`question_votes`**: `question_id` (FK), `participant_id` (FK), `created_at`.
  - **`PRIMARY KEY (question_id, participant_id)`**: Strictly enforces that an individual participant identity can cast at most **one upvote** per question directly at the database engine level.
- **`polls`**: `id` (PK, UUID), `session_id` (FK -> `sessions`), `question`, `status` (`draft` | `active` | `closed`), `show_results` (0/1), `created_at`.
- **`poll_options`**: `id` (PK, UUID), `poll_id` (FK -> `polls`), `text`, `votes_count`, `sort_order`.
- **`poll_votes`**: `poll_id` (FK), `participant_id` (FK), `option_id` (FK -> `poll_options`), `created_at`.
  - **`PRIMARY KEY (poll_id, participant_id)`**: Strictly enforces that an individual participant can cast at most **one vote** per poll.

### 2. Strict Server-Side 1-Vote Enforcement
Frontend state checks are easily bypassed by disabling JavaScript or firing raw HTTP requests. To ensure strict integrity:
- Every voting request requires a participant token (`participantId`).
- The backend checks for prior votes in `question_votes` and `poll_votes`.
- If a vote already exists, the server rejects the request with **HTTP 409 Conflict**: `{"error": "You have already voted..."}`.
- SQLite transactions wrap both the vote insertion and the count increment atomically, protected by database unique constraints.

### 3. Real-Time WebSockets Architecture
- Powered by **Socket.IO** with automatic WebSocket transport and HTTP polling fallback.
- Clients subscribe to scoped event rooms: `session:${code.toUpperCase()}`.
- Emitted events trigger reactive UI updates without manual polling or browser refreshes:
  * `session:participant_count`: Live connected audience counter with pulse badge.
  * `question:created`: Instant addition of new audience questions.
  * `question:upvoted`: Real-time ranking adjustment and vote tally animations.
  * `question:updated`: Real-time status changes (answered, spotlighted on stage, hidden).
  * `poll:activated`: Instant presentation of the active poll across all attendee screens.
  * `poll:voted`: Real-time animated percentage bars and vote counters.

### 4. Presenter View (Stage Mode)
- Optimized for large 1080p and 4K auditorium projectors with high-contrast dark aesthetic (`bg-slate-950`).
- Oversized typography readable from 50+ feet away.
- Dynamic QR code for back-row attendees to scan and join instantly.
- Hotkeys: `Space` / `→` (next question), `←` (previous question), `P` (toggle poll/questions), `F` (fullscreen).

---

## 🎯 Stretch Features Implemented

1. **Anonymous Questions:**
   - Audience members can toggle "Post anonymously" when submitting questions.
   - When enabled, `is_anonymous = 1` is recorded. The author name is masked as `"Anonymous"` in public responses, safeguarding attendee identity while still allowing upvote tracking.
2. **Session Export (CSV & JSON):**
   - Hosts can download full session reports at any time with one click from the control room.
   - **CSV Export:** Formatted for instant opening in Microsoft Excel or Google Sheets, containing session metadata, question transcripts with upvotes and answered status, and poll option vote distributions.
   - **JSON Export:** Structured JSON payload for automated event pipeline integration.

---

## 📋 What is Finished, What Isn't, and Future Work

### Finished:
- [x] Host registration, login, and JWT session authentication.
- [x] Session creation with auto-generated or custom 6-character short join codes.
- [x] Account-less audience joining with display names and persistent localStorage identity.
- [x] Live ranked Q&A with upvoting and real-time sorting (Top Voted, Newest, Answered).
- [x] Host question moderation: mark answered, stage spotlight/pin, hide/unhide, and delete.
- [x] Live single-choice polls with dynamic option creation and animated percentage bars.
- [x] Dedicated Presenter View optimized for stage projectors with keyboard shortcuts.
- [x] Strict server-side enforcement of 1 vote per person per question and poll.
- [x] Zero-refresh live updates via Socket.IO WebSocket rooms.
- [x] Anonymous question submission toggle.
- [x] Full session export (CSV & JSON).
- [x] Scannable QR code generator for direct phone join.
- [x] 8 automated integration tests passing.
- [x] Demo seed script (`npm run seed`) with sample host, session `DEMO26`, and questions/polls.
- [x] Responsive design tested across mobile, tablet, and desktop viewports.

### What Could Be Added With More Time:
- **Multiple-Choice & Word Cloud Polls:** Expanding beyond single choice to multi-select checkboxes, rank-ordered choices, and real-time word clouds.
- **AI-Powered Question Deduplication & Clustering:** Using an LLM to group similar audience questions (e.g., merging 5 questions asking about pricing into one theme).
- **Profanity & Sentiment Filtering:** Automatic sentiment tagging and bad-word masking on audience question submission.
- **Audience Live Emoji Reactions:** Floating hearts, thumbs up, and applause animations streaming across the presenter screen.

---

## 🤖 AI Tools Used & Attribution

During the development of this project, the following AI tools and capabilities were utilized:
- **Google DeepMind Antigravity Coding Assistant (Gemini 3.8 Flash):** Used for scaffolding the architecture, designing the relational database schema, authoring the Socket.IO real-time event protocols, creating the responsive Tailwind UI components, and drafting comprehensive integration tests.
- **Interactive Verification & Pair Programming:** Employed to detect path-resolution quirks on Windows with ampersand symbols in folder names and to implement cross-platform WebAssembly SQLite bindings via `sql.js`.

---

## 📄 License
MIT License. Built for seamless live events and presentations.
