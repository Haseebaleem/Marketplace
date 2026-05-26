# Marketplace

> Multi-vendor e-commerce platform with a 3-role system (Admin / Supplier / Buyer), atomic concurrency-safe operations, comprehensive audit logging, and a monorepo architecture with type-safe API contracts. Built with Next.js 14, TypeScript, Node.js, Express, PostgreSQL, and Prisma.

[![Status](https://img.shields.io/badge/Status-Work_in_Progress-orange?style=flat-square)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎯 About

Marketplace is a multi-vendor e-commerce platform — suppliers register and sell products, buyers browse and checkout, admins moderate the ecosystem. This project is **currently in active development** with Phases 1–2 complete and Phases 3–6 in the roadmap. Rather than presenting it as finished, this README is honest about scope: the codebase represents real engineering work demonstrating monorepo architecture, atomic concurrency safety, content-based file validation, and senior-level production patterns, but several user-facing features remain unbuilt.

Portfolio integrity matters more than appearing complete. The patterns implemented so far are reviewable in the codebase — the rest is roadmap.

---

## ✨ Features

### Built and Working (Phases 1-2)
- 🔐 Three-role authentication (Admin / Supplier / Buyer) with role-based middleware
- 🏪 Supplier profile management with logo upload
- 📦 Product CRUD with multi-image upload (Multer + Sharp processing)
- 🏷️ Hierarchical category tree (parent-child relationships)
- 📊 Supplier dashboard with stats and recent activity
- 🗑️ Soft-delete on referenced products, hard-delete otherwise
- 🔄 Atomic slug collision handling with retry on `P2002` unique constraint
- 📜 System-wide audit logging with IP capture
- ✉️ Email queue infrastructure (sender to be wired in Phase 4)
- 🚦 Per-route rate limiting on auth endpoints
- ⚡ Parallel Sharp image processing (5 images = ~935ms end-to-end)
- 🛡️ Content-based MIME validation (Sharp metadata, not header trust)
- 🧪 37 acceptance test assertions passing on the backend
- 📐 TypeScript strict mode across backend, frontend, and shared schemas

### Planned (Phases 3-6)
- 🛒 Buyer storefront with search, filters, pagination
- 💳 Cart and atomic checkout with `SELECT FOR UPDATE` stock locking
- 📋 Order pipeline with state machine (PENDING → PAID → SHIPPED → DELIVERED)
- 🛠️ Admin panel for moderation, user management, refunds
- ⚙️ Email queue processor for transactional emails
- 📈 Platform analytics dashboard with Recharts

---

## 💡 Design Decisions

### Why a monorepo with shared schemas

The backend and frontend exchange typed data. Without a shared package, every API change requires manually duplicating types on both sides — a known source of drift bugs. The monorepo with npm workspaces puts Zod schemas in a `shared/` package consumed by both. Change the schema once, both sides get the new types at compile time. A mismatch becomes a TypeScript error, not a runtime 400.

### Why atomic slug collision handling with retry

When two suppliers concurrently create products with the same name, both might pass the "is this slug available?" check before either commits. The race surfaces as a PostgreSQL `P2002` unique constraint violation on the second insert. Rather than serializing all product creation (slow) or using application-level locks (complex), the pattern here wraps creation in a transaction with a bounded retry loop that catches `PrismaClientKnownRequestError` with code `P2002` and target including `slug` — all other errors pass through. Verified with 3-way concurrent product creation: all succeed with distinct slugs, zero unhandled errors.

### Why denormalize product name and price in OrderItem

Orders are historical records. If a supplier deletes a product or changes its price, the order must still show what the buyer actually paid. `OrderItem.productName` and `productPrice` are snapshots at order creation. Reprinting a 6-month-old invoice shows accurate data. Industry-standard pattern (Shopify, Stripe, Square).

### Why per-route rate limiting (not shared counters)

A shared counter across `/auth/register` and `/auth/login` means an attacker hammering registrations can lock out legitimate logins from the same IP. Independent per-route counters keep failure modes isolated. Discovered as a real bug during acceptance testing on Phase 1 — fixed and codified.

### Why JWT secret rotation isn't yet implemented

Scope discipline. Single-secret 7-day JWTs are appropriate for development. Phases 5-6 will introduce refresh tokens with rotation. Shipping the basic version first and adding sophistication when it provides value is preferable to over-engineering before product-market fit.

### Why content-based MIME validation

A header like `Content-Type: image/png` is set by the client — trivial to lie about. The actual proof an upload is an image is whether Sharp can parse it. The Multer filter is a coarse first pass; Sharp's metadata check is the real validator. Defense in depth without false negatives on legitimate clients that send `application/octet-stream` for valid WebP files.

### Why parallel Sharp processing instead of sequential

Initial implementation processed multiple uploaded images via a `for await` loop, which serialized them. Profiling showed 5 medium-size JPEGs took ~3 seconds — visibly slow. Wrapping in `Promise.all` parallelized the CPU-bound work across Node's libuv thread pool. Result: 5×(3000×2000 JPEG) → 1200px WebP + 300px thumb stack now returns in ~935ms end-to-end. Independent async operations should run in parallel.

### Why honest WIP framing instead of hiding incomplete sections

Recruiters who clone repos and find broken flows lose trust faster than those who see clear scope statements upfront. This README explicitly marks what's built and what isn't, with a phased roadmap. The completed phases demonstrate real production patterns; the planned phases show forward thinking. Honesty here is a feature, not a confession.

---

## 🛠️ Tech Stack

### Backend
| Category | Technology |
|----------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict) |
| Framework | Express.js |
| Database | PostgreSQL 14+ |
| ORM | Prisma 6.x |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod (shared schemas) |
| File Upload | Multer 2.x |
| Image Processing | Sharp |
| Rate Limiting | express-rate-limit |
| Logging | Winston |
| Testing | Jest + supertest |

### Frontend
| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Notifications | react-hot-toast |

### Shared
- Zod schema package consumed by both backend and frontend for type-safe API contracts

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│              Monorepo Workspaces                 │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  backend/   │  │  frontend/  │  │ shared/  │  │
│  │  Express    │  │  Next.js 14 │  │ Zod      │  │
│  │  Prisma     │  │  TanStack   │  │ schemas  │  │
│  │  Postgres   │  │  shadcn/ui  │  │          │  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  │
│         │                │              │        │
│         │  imports shared schemas       │        │
│         ├────────────────┴──────────────┤        │
│         │                                        │
│         ▼                                        │
│  ┌─────────────────┐                             │
│  │  PostgreSQL     │                             │
│  │  12 models      │                             │
│  └─────────────────┘                             │
└──────────────────────────────────────────────────┘
```

**Database schema (12 models):**
- **User** — base auth, role-discriminated (ADMIN / SUPPLIER / BUYER)
- **SupplierProfile** — store name, slug, description, logo (1:1 with User)
- **BuyerProfile** — phone, default address (1:1 with User)
- **Category** — hierarchical with `parentId` self-reference
- **Product** — supplier-owned, indexed on supplier/category/active+createdAt
- **ProductImage** — ordered, unique on `(productId, order)`
- **CartItem** — buyer's cart, unique on `(buyerId, productId)` *(Phase 3)*
- **Order** — buyer-owned with state machine *(Phase 4)*
- **OrderItem** — denormalized product name + price snapshot *(Phase 4)*
- **OrderStatusHistory** — every status transition with actor + timestamp *(Phase 4)*
- **AuditLog** — system-wide action log with IP capture
- **EmailQueue** — async email send with retry tracking *(processor in Phase 4)*

Full Prisma schema at `backend/prisma/schema.prisma`.

---

## 📋 Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **npm** 9+

---

## 🚀 Getting Started

### Clone

```bash
git clone https://github.com/Haseebaleem/Marketplace.git
cd Marketplace

# Install all workspace dependencies
npm install
```

### Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with PostgreSQL credentials and JWT secret

# Create database
psql -U postgres -c "CREATE DATABASE marketplace_dev;"

# Run migrations
npx prisma migrate dev

# Start backend (port 4000)
npm run dev
```

### Frontend setup

In a new terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. You can register a buyer or supplier account and explore the supplier dashboard, product creation with image upload, and the audit log entries that get generated for every action.

**Note:** Phases 3-6 endpoints exist as schema/scaffold only — calling those routes will return 404 or "not implemented" responses.

---

## 📡 API Endpoints (Phases 1-2)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register as buyer or supplier |
| POST | `/api/v1/auth/login` | Authenticate, returns JWT |
| GET | `/api/v1/auth/me` | Current user + profile |

### Supplier (requires SUPPLIER role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/v1/supplier/profile` | Get/update store profile |
| POST | `/api/v1/supplier/profile/logo` | Upload store logo |
| GET | `/api/v1/supplier/dashboard` | Stats and recent activity |
| GET/POST | `/api/v1/supplier/products` | List/create products |
| GET/PATCH/DELETE | `/api/v1/supplier/products/:id` | Detail/update/delete |
| POST | `/api/v1/supplier/products/:id/images` | Add image |
| DELETE | `/api/v1/supplier/products/:id/images/:imageId` | Remove image |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/categories` | Hierarchical category tree |
| GET | `/health` | Service + DB health check |

### Planned (Phases 3-6)
- Public product browse with search/filter/sort
- Cart endpoints
- Checkout and order pipeline
- Admin panel routes
- Buyer order history

---

## 📁 Project Structure

```
Marketplace/
├── backend/
│   ├── src/
│   │   ├── config/         # singleton Prisma client
│   │   ├── controllers/    # auth, supplier, product, category
│   │   ├── middleware/     # auth, role, rate-limit, error
│   │   ├── routes/
│   │   ├── services/       # audit, dashboard, product
│   │   ├── utils/
│   │   ├── validators/
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma   # 12 models
│   │   └── migrations/
│   ├── uploads/            # gitignored
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router
│   │   ├── components/
│   │   ├── lib/
│   │   └── hooks/
│   └── package.json
├── shared/
│   └── src/
│       └── schemas/        # Zod schemas, consumed both sides
├── package.json            # workspaces root
└── README.md
```

---

## 🔐 Security Practices

- JWT-based authentication with role-discriminated authorization
- bcrypt password hashing — never plain text, never returned in responses
- Per-route rate limiting on `/auth/register` and `/auth/login` with independent counters
- Content-based MIME validation via Sharp metadata parsing (not trusting client headers)
- All uploads converted to WebP server-side — original files never served
- UUID filenames for uploads (never original filenames, preventing path traversal)
- Audit logs capture IP per action for incident investigation
- Suspended account enforcement — instant 403 without token refresh wait
- Strict Zod validation at every route boundary
- Prisma's parameterized queries prevent SQL injection
- CORS configured to frontend origin only
- `.env` gitignored, `.env.example` committed with placeholders

---

## 🧪 Testing

```bash
cd backend
npm test
```

**Coverage:** 37 assertions across Phase 1 + Phase 2 features (auth, role gating, product CRUD with concurrent creation, slug collision retry, supplier ownership boundaries, image upload with mime validation, audit logging).

---

## 🗺️ Implementation Roadmap

### ✅ Phase 1 — Foundation (Complete)
- Monorepo setup with npm workspaces
- TypeScript strict configuration across all packages
- Prisma schema and initial migration
- Auth: register, login, `/me` for 3 roles
- Rate limiting (per-route counters)
- Audit log foundation
- Email queue enqueue (processor deferred)
- Health endpoint with DB connectivity check
- Frontend scaffold: Next.js 14 + Tailwind + shadcn/ui
- Login/Register pages with role selector
- 22 acceptance assertions passing

### ✅ Phase 2 — Supplier Features (Complete)
- Supplier profile endpoints (read/update own)
- Product CRUD with multipart image upload
- Multi-variant image processing (Sharp)
- Soft-delete on referenced products, hard-delete otherwise
- Atomic slug collision handling with P2002 retry
- Public categories tree endpoint
- Supplier dashboard stats (parallelized queries)
- Frontend: supplier dashboard, products list, product create/edit forms
- Store profile edit page
- 37 cumulative acceptance assertions passing

### 🚧 Phase 3 — Buyer Storefront (Planned)
- Public product browse with search, filter, sort, pagination
- Public product detail page (SSR for SEO)
- Supplier public store page
- Cart endpoints with active/stock/supplier-suspended validation
- TanStack Query setup for client-side data
- Homepage with featured products + category grid

### 🚧 Phase 4 — Order Pipeline (Planned)
- Atomic checkout with `SELECT FOR UPDATE` stock locking
- Order state machine (PENDING → PAID → PROCESSING → SHIPPED → DELIVERED, + CANCELLED, REFUNDED)
- Mock payment endpoint
- Per-supplier shipping for multi-vendor orders
- Email queue processor
- Order expiration cron job (24h PENDING auto-cancel)
- Buyer order history and detail pages

### 🚧 Phase 5 — Admin Panel (Planned)
- Platform-wide dashboard with Recharts
- User management (suspend/unsuspend)
- Product moderation (flag/remove)
- Refund flow with stock restoration
- Audit log viewer with filters
- Category management

### 🚧 Phase 6 — Polish (Planned)
- Background jobs scheduler
- Comprehensive integration test suite
- Seed script for demo data
- README finalization with screenshots and demo GIF

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file. Use it as a reference, starting point, or learning resource.

---

## 👤 Author

**Haseeb Aleem**
Senior Full Stack Developer & Team Lead

- 💼 **LinkedIn:** [linkedin.com/in/haseeb-aleem-dev](https://www.linkedin.com/in/haseeb-aleem-dev/)
- 💻 **GitHub:** [github.com/Haseebaleem](https://github.com/Haseebaleem)
- 📧 **Email:** haseebaleem2802@gmail.com
- 📍 **Location:** Multan, Pakistan (Open to Saudi Arabia & GCC relocation)

---

⭐ Star this if you're interested in following along as Phases 3-6 ship.
