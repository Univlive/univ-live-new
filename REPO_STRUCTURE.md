# Repository Structure Standard

Feature-first architecture with a shared core. Migration complete.

## Layout

```
src/
├── app/
│   ├── providers/     # AuthProvider, TenantProvider (contexts)
│   └── routes/        # adminRoutes, educatorRoutes, studentRoutes, publicRoutes
├── features/
│   ├── admin/         # Admin pages + components/
│   ├── educator/      # Educator pages + components/ + test-series/
│   └── student/       # Student pages + components/ + types.ts
├── entities/          # Reusable domain models and domain-level UI
├── widgets/
│   └── layout/        # AnnouncementBar, Footer, Layout, Navbar
├── shared/
│   ├── auth/          # RequireRole
│   ├── components/    # common/, home/, sections/, ImpersonationBanner, NavLink
│   ├── hooks/         # useAIStream, useFavicon, use-mobile, use-toast
│   ├── lib/           # firebase, utils, imagekitUpload, tenant, etc.
│   ├── routes/        # StudentRoute
│   ├── services/      # authService, tenantService
│   └── ui/            # shadcn/ui primitives (53 components)
├── pages/             # Public/marketing pages only (Index, Login, Signup, etc.)
└── themes/            # Multi-tenant theming (coaching/theme1-3, builder)
```

## Path Aliases

| Alias | Maps to |
|-------|---------|
| `@app/*` | `src/app/*` |
| `@features/*` | `src/features/*` |
| `@entities/*` | `src/entities/*` |
| `@widgets/*` | `src/widgets/*` |
| `@shared/*` | `src/shared/*` |
| `@/*` | `src/*` (fallback — prefer specific aliases) |

## Rules

1. Keep route files thin — route declaration only, no business logic.
2. Role-specific screens live in `features/*`, not `pages/`.
3. `pages/` is only for public/marketing pages (Index, Login, Signup, etc.).
4. Move components into `entities/` or `shared/` when reused by 2+ features.
5. Keep API adapters close to their feature (`api.ts`) unless globally shared.
6. Prefer explicit naming to avoid collisions (e.g., `MarketingHeroSection`, `TenantHeroSection`).

## Migration Status

- [x] New architecture layers + aliases
- [x] Modular route composition (`src/app/routes/`)
- [x] educator/test-series migrated to `features/`
- [x] All educator, student, admin pages migrated to `features/`
- [x] Domain components moved to `features/*/components/`
- [x] Shared UI moved to `shared/ui/`
- [x] Shared utilities moved to `shared/hooks|lib|services/`
- [x] Contexts moved to `app/providers/`
- [x] Dead pages and unused theme components removed
- [x] `mock/` directory removed (types moved to `features/student/types.ts`)
- [ ] Add ESLint layer-boundary enforcement
- [ ] Populate `entities/` with reusable domain models
