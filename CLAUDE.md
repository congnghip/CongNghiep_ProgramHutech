# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HUTECH Program Management System — a web application for managing university training programs (CTDT) at HUTECH University. Vietnamese-language UI. Built as a monolithic Express.js app with server-rendered SPA frontend and PostgreSQL backend.

## Commands

```bash
# Local development (with --watch for auto-reload)
make dev          # or: npm run dev

# Production
make start        # or: npm start

# Docker (runs both app + PostgreSQL)
make up           # docker compose up -d
make down         # docker compose down
make logs         # view all logs
make db-shell     # psql into the database
```

App runs on port 3600. Database on port 5434 (local) / 5432 (in Docker).

## Architecture

**Two-file backend:** Everything lives in `server.js` (~1500 lines) and `db.js` (~475 lines). No router separation — all API routes are defined inline in server.js.

- `db.js` — PostgreSQL connection pool, schema creation (`initDB`), seed data (roles, departments, permissions, admin user), and RBAC helper functions (`hasPermission`, `getUserRoles`, `isAdmin`)
- `server.js` — Express app with all API routes, auth middleware (JWT via cookies), permission middleware (`requirePerm`, `requireDraft`), audit logging, and approval workflow logic

**Frontend SPA:** `public/index.html` is the shell. `public/js/app.js` handles routing/navigation. Page modules are in `public/js/pages/` (programs, version-editor, courses, syllabus-editor, approval, users, departments, rbac-admin, dashboard, audit-logs).

**Database:** PostgreSQL 15. Schema is auto-created on startup via `initDB()`. No migration files — schema changes are done by modifying `db.js` with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## Key Domain Concepts

- **Programs** (CTDT) have **Versions** (by academic year) with a status-based approval workflow: `draft` -> `submitted` -> `approved_khoa` -> `approved_pdt` -> `approved_bgh` -> `published`
- Each version contains: PO (objectives), PLO (learning outcomes), PI (performance indicators), Courses, Matrices (PO-PLO, Course-PLO, Course-PI), Assessment Plans, Syllabi
- **RBAC:** 6 roles (GIANG_VIEN, TRUONG_NGANH, LANH_DAO_KHOA, PHONG_DAO_TAO, BAN_GIAM_HIEU, ADMIN) with department-scoped assignments. Roles at level >= 4 have global access.
- Permissions are granular (43 codes across modules: programs, syllabus, courses, portfolio, rbac)

## API Structure

All routes under `/api/`. Auth via JWT cookie (`token`). Pattern:
- `GET/POST /api/versions/:vId/{objectives,plos,courses,assessments,syllabi}` — CRUD for version sub-entities
- `GET/PUT /api/versions/:vId/{po-plo-map,course-plo-map,course-pi-map}` — matrix mappings
- `POST /api/approval/submit` and `POST /api/approval/review` — approval workflow
- RBAC admin: `/api/users`, `/api/roles`, `/api/departments`, `/api/permissions`

## Environment

Config via `.env` file: `JWT_SECRET`, `DB_NAME`, `DB_USER`, `DB_PASS`, `PORT`. Docker compose also sets `DB_HOST` and `DB_PORT`.

## Notes

- The app connects to an external Docker network `canvas_default` for integration with other services
- `backups/` contains compressed SQL backup files
- `openspec/` contains change specification documents (used by agent workflows in `.agent/`)
- No test framework is configured
- No linter is configured
