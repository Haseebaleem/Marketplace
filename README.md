# Marketplace

A multi-vendor e-commerce platform with three roles (Admin, Supplier, Buyer), atomic checkout with stock locking, per-supplier order fulfillment, queued email notifications, and an admin audit log.

> **Status:** Phase 1 (foundations + auth) complete. Subsequent phases land supplier features, the buyer storefront, the order pipeline, the admin panel, and tests. See [Roadmap](#roadmap).

## Tech stack

| Layer       | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Backend     | Node 20+, Express, TypeScript (strict), Prisma 6 + PostgreSQL     |
| Auth        | JWT (HS256), bcrypt, express-rate-limit                           |
| Frontend    | Next.js 14 (App Router), TypeScript (strict), Tailwind, shadcn/ui |
| State       | TanStack Query v5, Zustand                                        |
| Forms       | React Hook Form + Zod (shared schema package)                     |
| Validation  | Zod (schemas live in `shared/`, both sides infer types)           |
| Logging     | Winston                                                           |
| Tests       | Jest + supertest (lands in Phase 6)                               |

## Monorepo layout

```
.
├── backend/      Express + Prisma API
├── frontend/     Next.js 14 client
├── shared/       @marketplace/shared — Zod schemas + inferred types
├── package.json  npm workspaces root
└── README.md
```

## Prerequisites

- Node.js 20 or later
- PostgreSQL 14+ running locally (or any reachable Postgres instance)
- npm 10+

## Setup

```bash
# 1. Install all workspaces
npm install

# 2. Create the database (default credentials assumed)
createdb marketplace_dev      # or use psql/pgAdmin

# 3. Configure backend env
cp backend/.env.example backend/.env
#    Edit backend/.env — at minimum set DATABASE_URL and JWT_SECRET
#    JWT_SECRET must be at least 32 characters.

# 4. Apply Prisma migrations + generate client
npm run prisma:migrate

# 5. Configure frontend env
cp frontend/.env.example frontend/.env.local
```

## Running locally

Two terminals:

```bash
# Terminal 1 — backend on :4000
npm run dev:backend

# Terminal 2 — frontend on :3000
npm run dev:frontend
```

Then open <http://localhost:3000>.

## What works today (Phase 1)

- `POST /api/v1/auth/register` — Buyer or Supplier registration (discriminated by `role`; suppliers also send `storeName`, which seeds a unique `storeSlug`).
- `POST /api/v1/auth/login` — returns JWT + user payload. Suspended accounts are blocked.
- `GET /api/v1/auth/me` — current user with role-appropriate profile.
- `GET /api/v1/health` — `{ status, dbConnected, timestamp }` (503 when DB is unreachable).
- Rate limiting on register/login (5 requests / 15 min / IP).
- Audit log rows for `USER_REGISTERED` and `USER_LOGIN`.
- Welcome email queued in `EmailQueue` (the actual sender lands in Phase 4).
- Frontend pages: `/`, `/login`, `/register` (with Buyer/Supplier toggle).

## Project conventions

- **TypeScript strict mode** in every workspace, including `noUncheckedIndexedAccess`.
- **Shared validation**: the same Zod schema validates the request on the backend and the form on the frontend, so the wire format can't drift.
- **Error envelope**: every API error returns `{ error, code, details? }` with a stable machine-readable `code`.
- **Atomic conventional commits** — one logical change per commit, prefixed `feat(scope)`, `fix(scope)`, etc.

## Security

- Passwords are hashed with bcrypt (10 rounds, configurable).
- JWTs are signed HS256 with a secret loaded from env (validated at boot — the server won't start if `JWT_SECRET` is shorter than 32 characters).
- Login runs `bcrypt.compare` even when the user does not exist, to mitigate email enumeration via timing.
- Helmet provides default security headers; CORS is restricted to the configured frontend origin(s).
- Rate limiting on auth routes uses `express-rate-limit` with the draft-7 `RateLimit-*` headers.

**JWT storage.** The frontend stores the JWT in `localStorage` and sends it via `Authorization: Bearer`. That's deliberate: it's the conventional pattern for SPAs with a separate API, integrates cleanly with TanStack Query, and is easy to debug. A production deployment hardened against XSS would move to `httpOnly` cookies with CSRF protection — that tradeoff is intentionally deferred for this project.

## Environment reference (backend)

| Variable                     | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `DATABASE_URL`               | Postgres connection string                         |
| `JWT_SECRET`                 | Signing secret (min 32 chars)                      |
| `JWT_EXPIRES_IN`             | Token lifetime, e.g. `7d`                          |
| `FRONTEND_URL`               | Allowed CORS origin(s), comma-separated            |
| `BCRYPT_ROUNDS`              | bcrypt cost factor (default 10)                    |
| `RATE_LIMIT_AUTH_MAX`        | Auth requests per window (default 5)               |
| `RATE_LIMIT_AUTH_WINDOW_MS`  | Window length in ms (default 900000 = 15 min)      |
| `MAIL_*`                     | Mailtrap SMTP config (used from Phase 4 onwards)   |
| `SEED_ADMIN_*`               | Admin seed credentials (Phase 6 seed script)       |

## Roadmap

- **Phase 1 — Foundations & Auth** ✅ this release
- **Phase 2 — Supplier features**: store profile, product CRUD with image upload (Multer + Sharp), categories, supplier dashboard.
- **Phase 3 — Buyer storefront & Cart**: product browse with filters/search, cart endpoints, product detail page.
- **Phase 4 — Order pipeline**: atomic checkout with `SELECT FOR UPDATE` stock locking, mock payment, per-supplier shipping, email queue processor.
- **Phase 5 — Admin panel**: dashboards (Recharts), user management, refunds, audit log viewer.
- **Phase 6 — Polish & tests**: order-expiration cron, integration tests, seed data, full setup docs.

## License

MIT — see [LICENSE](LICENSE).
