# Floorbase

Floorbase is an admin-first, multi-tenant-ready reservation platform foundation for restaurants and hospitality venues.

This repository contains a single Next.js application (App Router) with TypeScript, Tailwind CSS, shadcn/ui setup, and Prisma configured for PostgreSQL.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui configuration
- Prisma + PostgreSQL
- ESLint + Prettier

## Project Structure

```text
.
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                  # App Router entrypoint (layout, global styles, routes)
│   ├── components/
│   │   ├── layout/           # Shared layout building blocks (future)
│   │   └── ui/               # shadcn/ui components (future)
│   ├── features/             # Product feature modules (future)
│   ├── lib/                  # Shared utilities
│   ├── server/
│   │   └── db/
│   │       └── prisma/       # Prisma client setup
│   └── env.ts                # Runtime env validation
├── .env.example
├── components.json           # shadcn/ui config
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL credentials.

### 3) Generate Prisma client

```bash
npm run db:generate
```

### 4) Run initial migration

```bash
npm run db:migrate -- --name init
```

### 5) Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Notes

- This scaffold intentionally excludes product/business features.
- Domain models (organizations, venues, tables, guests, reservations, etc.) should be introduced in the next implementation tasks.
