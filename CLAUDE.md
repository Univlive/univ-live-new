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
| `src/components/auth/RequireRole.tsx` | Route-level role guard |
| `src/components/routes/StudentRoute.tsx` | Student route protection |
| `src/contexts/` | AuthContext, TenantContext |
| `src/lib/studentRegistration.ts` | POST `/api/tenant/register-student` on login |
| `src/lib/firebase.ts` | Firebase client init |
| `src/services/` | Auth service, tenant service |
| `api/_lib/` | Shared Vercel function utils (Firebase admin, Razorpay, Gemini, Discord logging) |
| `api/tenant/` | Tenant slug lookup, student registration |
| `api/billing/` | Razorpay seat assign/revoke/update |
| `api/ai/` | AI performance analysis, question import |
| `vite.config.ts` | Dev server + proxy config |
| `vercel.json` | Vercel routing rules |

## Pages

### Main Domain
- `/` — marketing landing page
- `/admin` → `/admin/login` → admin dashboard
- `/admin/educators` — educator management (create educators here)
- `/admin/plans`, `/admin/coupons`, `/admin/payment-logs`, `/admin/seats`, `/admin/subjects`
- `/admin/content` — Admin content library (books/notes per subject)
- No `/login` or `/signup` on main domain (intentional)

### Tenant Domain
- `/login` — educator + student login
- `/signup` — student signup via invite token
- `/educator/*` — educator portal (dashboard, learners, billing, tests, content, etc.)
- `/educator/content` — per-course content management; import from admin library
- `/student/*` — student portal (dashboard, tests, results, rankings, content)
- `/student/content` — view books/notes for enrolled course

## Multi-Tenant Theming
- `src/themes/coaching/` — theme1, theme2, theme3 for tenant home pages
- Theme selected per tenant in Firestore

## Educator Defaults (on creation)
- `maxBatches: null` — unlimited until admin sets it
- `allowedSubjects: []` — no subjects until admin assigns
- `seatLimit: 0` — no seats until purchased

## Payments
- Razorpay for seat purchases
- Webhook at `api/razorpay/`
- Billing managed in `api/billing/`

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
- Vercel functions use `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 or raw JSON), `RAZORPAY_*`, `GEMINI_API_KEY`, `DISCORD_WEBHOOK_URL`
- `ADMIN_MAX_FILE_SIZE_MB` — max upload size for admin content (default 100)
- `EDUCATOR_MAX_FILE_SIZE_MB` — max upload size for educator content (default 20)

## Dev Commands
```bash
bun run dev          # start dev server on :8080
bun run build        # production build
bun run lint
```

---
_Keep this file updated whenever routes, roles, major components, or architecture changes._
