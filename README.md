# Floorbase

Floorbase is an admin-first, multi-tenant-ready reservation platform foundation for restaurants and hospitality venues.

This repository contains a single Next.js application (App Router) with TypeScript, Tailwind CSS, and Prisma configured for PostgreSQL.

## Current Repository State

Recent commits in this branch show baseline app scaffolding and core reservation schema are in place.

Run `git log --oneline -n 5` locally to verify history in your environment.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- ESLint + Prettier

## Local Development Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

```bash
cp .env.example .env
```

Set these auth values in `.env`:

- `AUTH_SESSION_SECRET` (required, 32+ chars)
- `AUTH_COOKIE_NAME` (default: `floorbase_session`)
- `AUTH_SESSION_TTL_HOURS` (default: `12`)
- `AUTH_INVITE_TTL_HOURS` (default: `72`)
- `SEED_DEFAULT_PASSWORD` (local/dev only)

### 3) Generate Prisma client

```bash
npm run db:generate
```

### 4) Run migration(s)

```bash
npm run db:deploy
```

### 5) Seed local development data

```bash
npm run db:seed
```

Seed includes one organization, one venue, areas/tables, business hours, staff users, admin role assignments, guests, and reservations.

### 6) Reset and reseed quickly

```bash
npm run db:reset
npm run db:reseed
```

### 7) Run app

```bash
npm run dev
```

## Auth Approach (v1)

The internal admin system uses **invite-only email/password auth** with server-managed sessions:

- no self-signup route
- admins create invite links via protected API (`POST /api/admin/users/invite`)
- invite recipient accepts invite on login page (`/login?inviteToken=...`) and sets password
- successful auth creates an HTTP-only cookie session backed by `AuthSession` records

### Why this fits a small B2B admin platform

- Simple operational model (no social auth/billing complexity)
- Invite-only access keeps staff onboarding controlled
- Session + role checks are easy to apply in server code
- Works well for internal backoffice and low-to-medium staff counts

## Role Model (v1)

- `SUPER_ADMIN`
- `ORGANIZATION_ADMIN`
- `VENUE_MANAGER`
- `HOST`

Role assignments are stored in `AdminRoleAssignment` and can be scoped to organization/venue.
There is no separate membership role system in runtime auth checks.

## Role Enforcement

- `/admin` routes are protected by middleware cookie presence check + server-side auth guard.
- server-side helpers:
  - `requireAuthenticatedUser()`
  - `requireRole([...])`
- sensitive example endpoint:
  - `POST /api/admin/reservations/status` requires `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, or `VENUE_MANAGER`

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks
- `npm run format` - Format code with Prettier
- `npm run format:check` - Verify formatting
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run development migrations
- `npm run db:deploy` - Apply migrations in deploy environments
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed local data
- `npm run db:reset` - Drop all data, rerun migrations, then seed
- `npm run db:reseed` - Reset + reseed quickly for local iteration

## Production Hardening Follow-ups

- Add rate-limiting and lockout policies for login + invite acceptance.
- Rotate and audit session tokens; add background cleanup for expired sessions.
- Enforce stricter password policy + optional MFA for high-privilege roles.
- Add audit logs for invite issuance, role changes, and auth failures.
- Consider moving from app-generated invite links to transactional email delivery.
