# univ-live-new — Codebase Context

## What This Is
Multi-tenant SaaS platform for coaching institutes. Built with React + TypeScript + Vite + Tailwind + shadcn/ui. Deployed on Vercel.

## Architecture

### Domains
- **Main domain** (`univlive.tech` / `localhost:8080`): marketing site + admin panel
- **Tenant subdomains** (`{slug}.univlive.tech`): educator portal + student portal

### Auth & Roles
- Firebase Auth for login; Firebase Firestore for user data
- Three roles: `ADMIN`, `EDUCATOR`, `STUDENT`
- Role stored in Firestore `users/{uid}.role`, also resolved from token claims
- `RequireRole` component guards routes; admin routes use `redirectTo="/admin/login"`
- `StudentRoute` checks `profile.enrolledTenants` or `profile.tenantSlug`

### API Layer
- Serverless functions in `api/` (TypeScript, deployed as Vercel functions)
- Dev proxy: `vite.config.ts` → `vite dev` proxies `/api` to `https://www.univlive.tech`
- To proxy to local vercel dev instead: `vite dev --mode vercel` (targets `localhost:3000`)

### Backend (separate repo)
- `monkey-king` Python FastAPI backend handles payments, coupons, educator/student mgmt
- Runs on `localhost:8000` in dev; deployed separately

## Key Files

| File | Purpose |
|------|---------|
| `src/AppRoutes.tsx` | Central routing; tenant vs main domain split |
| `src/app/routes/` | Modular route files (admin, educator, student, public) |
| `src/app/providers/` | AuthProvider, TenantProvider (contexts) |
| `src/shared/auth/RequireRole.tsx` | Route-level role guard |
| `src/shared/routes/StudentRoute.tsx` | Student route protection |
| `src/shared/lib/studentRegistration.ts` | POST `/api/tenant/register-student` on login |
| `src/shared/lib/firebase.ts` | Firebase client init |
| `src/shared/services/` | Auth service, tenant service |
| `src/shared/ui/MultiSelect.tsx` | Generic multi-select dropdown (options prop, no Firestore fetch) |
| `src/shared/hooks/useAccessibleCourses.ts` | Educator-scoped courses+subjects from allowedSubjectIds |
| `src/features/educator/` | All educator portal pages + components |
| `src/features/student/` | All student portal pages + components + types |
| `src/features/admin/` | All admin panel pages + components |
| `api/_lib/` | Shared Vercel function utils (Firebase admin, Gemini, Discord logging) |
| `api/tenant/` | Tenant slug lookup, student registration |
| `api/billing/` | Seat assign/revoke (billing status only, not enrollment) |
| `api/ai/` | AI performance analysis, question import |
| `vite.config.ts` | Dev server + proxy config |
| `vercel.json` | Vercel routing rules |

## Pages

### Main Domain
- `/` — marketing landing page
- `/admin` → `/admin/login` → admin dashboard (revenue, educators, students, tests taken, active trials)
- `/admin/analytics` — platform activity: 7-day attempts chart, today's engagement, recent activity feed
- `/admin/educators` — educator management (create educators here)
- `/admin/plans`, `/admin/coupons`, `/admin/payment-logs`, `/admin/seats`, `/admin/subjects`
- `/admin/content` — Admin content library (books/notes per subject)
- No `/login` or `/signup` on main domain (intentional)

### Tenant Domain
- `/login` — educator + student login
- `/signup` — student signup via invite token
- `/educator/*` — educator portal (dashboard, learners, billing, tests, content, etc.)
- `/educator/dashboard` — focused: students count, live tests, avg score, active codes; quick actions
- `/educator/analytics` — deep analytics: student growth, attempts chart, top performers, subject heatmap (existing Analytics.tsx, now routed)
- `/educator/content` — per-course content management; import from admin library
- `/student/*` — student portal (dashboard, tests, results, rankings, content)
- `/student/dashboard` — live tests grid, resume in-progress, rank + avg score, leaderboard preview (top 5), score trend
- `/student/content` — view books/notes for enrolled course

## Multi-Tenant Theming
- `src/themes/coaching/` — theme1, theme2, theme3 for tenant home pages
- Theme selected per tenant in Firestore

## Educator Defaults (on creation)
- `maxBatches: null` — unlimited until admin sets it
- `allowedSubjects: []` — no subjects until admin assigns
- `seatLimit: 0` — no seats until purchased

## Payments
- **Cashfree** via `monkey-king` FastAPI backend (replaced Razorpay)
- Educator self-service: `POST /api/payment/initiate` → Cashfree checkout → `POST /api/payment/verify/{orderId}`
- Admin payment link: `POST /api/payment/admin/create-payment-link`
- Cashfree webhook: `POST /api/payment/webhook` (handled by monkey-king, not Vercel)
- `api/razorpay/webhook.ts` — legacy Razorpay handler; kept for existing subscriptions only
- `api/billing/update-quantity.ts` — returns 410 Gone (deprecated Razorpay subscription endpoint)
- Seat billing status (active/inactive per student): `api/billing/assign-seat.ts`, `api/billing/revoke-seat.ts`
- All amounts are in **rupees** (not paise)

## AI Features
- Gemini-powered question import (`api/ai/import-questions`)
- AI performance analysis per student
- AI website content generation for educator profiles

## AI Chatbot (RAG)
- **Route**: `/student/chatbot` — AI Tutor page for students
- **Backend**: `monkey-king /api/chat/*` endpoints (FastAPI)
  - `POST /api/chat/ingest` — indexes a content file into Pinecone (called automatically after educator upload)
  - `POST /api/chat/message` — RAG chat; requires STUDENT auth; reads `users/{uid}.educatorId+courseId`
  - `GET /api/chat/usage` — returns tokens used today vs. daily limit
- **Toggle**: "General search" switch — if OFF, only course content excerpts used; if ON, LLM also uses general knowledge
- **Token limit**: `educators/{uid}.chatDailyTokenLimit` (default 100,000) — set by admin via Educators page "Chat Limit" button
- **Daily usage**: `educators/{uid}/chatUsage/{YYYY-MM-DD}.tokensUsed` — auto-resets by date key
- **Vector DB**: Pinecone index `univ-content`, namespace `edu-{educatorId}`, metadata filter on `courseId`
- **Embeddings**: Google `text-embedding-004` (768-dim), Chat: `gemini-2.0-flash`

## Content Management
- **Firestore**: `admin_library/{contentId}` — admin-uploaded books/notes scoped by subject
- **Firestore**: `educators/{uid}/branches/{branchId}/courses/{courseId}/content/{contentId}` — per-course content
- Educators see only admin library items where `subjectId in allowedSubjectIds`
- Students read course content via their `educatorId + branchId + courseId` from profile
- File uploads use ImageKit scope `"content"` (`api/imagekit-auth.ts`)
- `src/lib/imagekitUpload.ts` exports `getContentUploadLimit()` to fetch per-role MB limit

## Environment Variables
- `VITE_FIREBASE_*` — Firebase client config
- Vercel functions use `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 or raw JSON), `GEMINI_API_KEY`, `DISCORD_WEBHOOK_URL`
- `RAZORPAY_WEBHOOK_SECRET` — still needed for legacy Razorpay webhook handler
- `ADMIN_MAX_FILE_SIZE_MB` — max upload size for admin content (default 100)
- `EDUCATOR_MAX_FILE_SIZE_MB` — max upload size for educator content (default 20)

## Filter System (Question Bank / Templates / Test Bank)
- **Cascade**: Course (single) → Subject (multi) → Topic (multi, QB only) → Tags (multi, QB only)
- **Courses**: `courses` collection `{id, name, isActive}` — admin sees all; educator sees only those derived from their `allowedSubjectIds` via `useAccessibleCourses`
- **Subjects**: `subjects` collection `{id, name, courseId}` — filtered by selected course; educator only sees allowed subjects
- **Topics/Tags**: free-text fields on questions (`topic`, `topics[]`, `tags[]`) — derived dynamically from filtered question pool
- **CSV import validation**: validates `course` and `subject` column values against Firestore before writing; throws with list of invalid rows + valid options
- **SectionCard (template editor)**: topics/tags per-section driven by question bank data passed from `CreateTemplateModal`
- **Educator bankTests**: pre-filtered in TestSeries to only show templates whose `courseId` is in educator's accessible courses

## Dev Commands
```bash
bun run dev          # start dev server on :8080
bun run build        # production build
bun run lint
```

---
_Keep this file updated whenever routes, roles, major components, or architecture changes._
