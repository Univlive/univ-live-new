# univ-live-new

Frontend for **Univ Live** — a multi-tenant SaaS platform for coaching institutes. Built with React + TypeScript + Vite + Tailwind CSS + shadcn/ui. Deployed on Vercel.

---

## What It Does

- **Main domain** (`univlive.tech`): marketing site + admin panel
- **Tenant subdomains** (`{slug}.univlive.tech`): educator portal + student portal
- Three roles: `ADMIN`, `EDUCATOR`, `STUDENT`
- Features: test series, question banks, AI chatbot (RAG), content management, billing, rankings, DPP generation

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | Firebase Auth |
| Database | Firebase Firestore |
| Payments | Razorpay (admin side) |
| AI | Gemini (via serverless functions) |
| Deployment | Vercel |
| Package Manager | Bun |

---

## Repository Structure

```
src/
├── app/
│   ├── providers/          # AuthProvider, TenantProvider (React contexts)
│   └── routes/             # Route files: adminRoutes, educatorRoutes, studentRoutes, publicRoutes
├── features/
│   ├── admin/              # Admin portal pages + components/
│   ├── educator/           # Educator portal pages + components/ + test-series/
│   └── student/            # Student portal pages + components/ + types.ts
├── entities/               # Reusable domain models (to be populated)
├── widgets/
│   └── layout/             # Navbar, Footer, Layout, AnnouncementBar
├── shared/
│   ├── auth/               # RequireRole guard
│   ├── components/         # common/, home/, sections/, shared UI pieces
│   ├── hooks/              # useAIStream, useFavicon, use-mobile, use-toast
│   ├── lib/                # firebase, utils, imagekitUpload, tenant helpers, etc.
│   ├── routes/             # StudentRoute guard
│   ├── services/           # authService, tenantService
│   └── ui/                 # shadcn/ui primitives (53 components)
├── pages/                  # Public/marketing pages only (Index, Login, Signup, etc.)
├── themes/                 # Multi-tenant theming (coaching/theme1-3, builder)
├── AppRoutes.tsx           # Root router — delegates to route files
└── App.tsx                 # Providers + query client

api/                        # Vercel serverless functions
├── _lib/                   # Firebase admin, Razorpay, Gemini, Discord logging
├── tenant/                 # Tenant slug lookup, student registration
├── billing/                # Razorpay seat assign/revoke/update
├── ai/                     # AI performance analysis, question import
└── razorpay/               # Razorpay webhook handler
```

### Path Aliases

| Alias | Maps to |
|-------|---------|
| `@app/*` | `src/app/*` |
| `@features/*` | `src/features/*` |
| `@entities/*` | `src/entities/*` |
| `@widgets/*` | `src/widgets/*` |
| `@shared/*` | `src/shared/*` |
| `@/*` | `src/*` (fallback) |

---

## Pages & Routes

### Main Domain
| Route | Page |
|-------|------|
| `/` | Marketing landing page |
| `/admin` | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | Revenue, educators, students, tests taken |
| `/admin/analytics` | 7-day charts, engagement, activity feed |
| `/admin/educators` | Educator management |
| `/admin/plans` | Subscription plan management |
| `/admin/coupons` | Coupon management |
| `/admin/payment-logs` | Payment history |
| `/admin/seats` | Seat assignment |
| `/admin/subjects` | Subject management |
| `/admin/content` | Admin content library (books/notes) |
| `/admin/templates` | Question bank templates |
| `/admin/question-bank` | Global question bank |

### Tenant Domain
| Route | Page |
|-------|------|
| `/` | Tenant home (themed per institute) |
| `/login` | Educator + student login |
| `/signup` | Student signup via invite token |
| `/educator/dashboard` | Educator overview |
| `/educator/learners` | Student management |
| `/educator/test-series` | Test management + question editor |
| `/educator/question-bank` | Per-educator question bank |
| `/educator/content` | Course content management |
| `/educator/analytics` | Deep analytics |
| `/educator/billing` | Seat purchases |
| `/educator/dpp` | DPP generation |
| `/educator/website-builder` | Institute website builder |
| `/student/dashboard` | Live tests, rank, score trend |
| `/student/tests` | Test browser |
| `/student/attempts` | Attempt history |
| `/student/results/:id` | Result + AI review |
| `/student/rankings` | Leaderboard |
| `/student/content` | Course content (books/notes) |
| `/student/chatbot` | AI tutor (RAG) |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager)
- Node.js 18+
- A Firebase project with Auth + Firestore enabled
- Access to `.env.local` (get from a team member)

### 1. Clone & Install

```bash
git clone <repo-url>
cd univ-live-new
bun install
```

### 2. Environment Variables

Copy the example and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

Serverless function vars (set in Vercel dashboard, not needed for local frontend dev):

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK JSON (base64 or raw) |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `DISCORD_WEBHOOK_URL` | Discord logging webhook |
| `ADMIN_MAX_FILE_SIZE_MB` | Max file upload size for admin (default: 100) |
| `EDUCATOR_MAX_FILE_SIZE_MB` | Max file upload size for educators (default: 20) |

### 3. Run Dev Server

```bash
bun run dev
```

Opens on `http://localhost:8080`.

By default, API calls proxy to the **production backend** (`https://www.univlive.tech`). To proxy to a local Vercel dev server instead:

```bash
bun run dev --mode vercel
# In a separate terminal:
vercel dev   # starts Vercel functions on :3000
```

---

## Dev Commands

```bash
bun run dev        # Start dev server on :8080
bun run build      # Production build
bun run lint       # ESLint
bun run preview    # Preview production build locally
```

---

## Architecture Notes

### Auth Flow
1. User logs in via Firebase Auth
2. Role (`ADMIN` | `EDUCATOR` | `STUDENT`) is read from Firestore `users/{uid}.role`
3. `RequireRole` component guards routes; redirects unauthorized access
4. Students also checked against `profile.enrolledTenants` or `profile.tenantSlug`

### Multi-Tenancy
- Tenant detected by subdomain (`slug.univlive.tech`) or from user profile
- `TenantProvider` fetches tenant config from Firestore `educators/{educatorId}`
- Themes (`theme1/2/3`) selected per educator's `builderConfig.themeKey`

### API Layer
- Serverless functions in `api/` deploy as Vercel Edge Functions
- `vite.config.ts` proxies `/api` to production in dev mode
- Separate Python backend (`monkey-king`) handles payments, invites, AI chatbot

### Feature-First Architecture
Each feature module in `src/features/` owns its pages, components, and types. Route files in `src/app/routes/` are thin — declarations only. Shared code lives in `src/shared/`.

---

## Deployment

Deployed automatically on Vercel via GitHub integration. Every push to `main` triggers a production deployment.

To trigger manually via Discord (using `devops-bot`):
```
/deploy
```

---

## Key Integrations

| Service | Purpose |
|---------|---------|
| Firebase Auth | User authentication |
| Firestore | All application data |
| Razorpay | Seat purchase billing |
| ImageKit | File/content uploads |
| Gemini AI | Question import, performance analysis |
| Pinecone | RAG vector store for AI chatbot |
| monkey-king | Python backend for payments, invites, AI chat |
