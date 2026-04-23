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
make restart      # restart containers
make logs         # view all logs
make logs-app     # logs for app container only
make logs-db      # logs for db container only
make app-shell    # shell into app container
make db-shell     # psql into the database
```

App runs on port 3600. Database on port 5434 (local) / 5432 (in Docker).
Health check: `GET /api/health`

## Architecture

**Two-file backend:** Everything lives in `server.js` (~4560 lines) and `db.js` (~888 lines). No router separation — all API routes are defined inline in server.js.

- `db.js` — PostgreSQL connection pool, schema creation (`initDB`), seed data (roles, departments, permissions, admin user), and RBAC helper functions (`hasPermission`, `getUserRoles`, `isAdmin`, `getDepartmentScope`)
- `server.js` — Express app with all API routes, auth middleware (JWT via cookies), permission middleware (`requirePerm`, `requireDraft`, `requireViewVersion`), audit logging, approval workflow logic, and notification system

**Utility modules (root level):**
- `word-parser.js` — parses `.docx` uploads into program/version data
- `word-exporter.js` — exports versions to `.docx` (legacy path)
- `pdf-syllabus-parser.js` — AI-assisted PDF → syllabus extraction (uses Gemini/Groq)

**Render pipeline (`server/render/`):**
- `render-model.js` — builds a normalized data model from DB for a course's base syllabus (used by both docx and pdf export)
- `content-upgrade.js` — upgrades/normalizes stored syllabus JSON content schema; called via `normalizeStoredSyllabusContent()` in server.js on every syllabus read
- `docx-builder.js` — generates Word documents from the render model
- `pdf-template.ejs` — EJS template rendered via Puppeteer for PDF export

**AI integrations:** `@google/generative-ai` (Gemini) and `groq-sdk` used for AI-assisted content parsing (`pdf-syllabus-parser.js`) and content upgrade (`content-upgrade.js`).

**Frontend SPA:** `public/index.html` is the shell. `public/js/app.js` handles routing/navigation. Page modules are in `public/js/pages/`.

**Database:** PostgreSQL 15. Schema is auto-created on startup via `initDB()`. No migration files — schema changes are done by modifying `db.js` with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## Key Domain Concepts

**Programs & Versions:**
- **Programs** (CTDT) have **Versions** (by academic year) with a status-based approval workflow: `draft` → `submitted` → `approved_khoa` → `approved_pdt` → `approved_bgh` → `published`
- Each version contains: PO (objectives), PLO (learning outcomes), PI (performance indicators), Courses, Knowledge Blocks, Teaching Plan, Matrices (PO-PLO, Course-PLO, Course-PI), Assessment Plans, Syllabi
- Versions can also be organized into **Cohorts** (`program_cohorts`) with **Variants** (`cohort_variants`) for multi-track programs

**Syllabi:**
- Each version course can have a **Syllabus** (`version_syllabi`) with CLOs (Course Learning Outcomes), a CLO-PI map, and detailed section content stored as JSON
- A **Base Syllabus** (`course_base_syllabi`) is a reusable template attached to a course (not a version); syllabi can be loaded from or promoted to base
- Syllabus content JSON is versioned/upgraded on read via `content-upgrade.js`

**RBAC:**
- 6 roles: `GIANG_VIEN`, `TRUONG_NGANH`, `LANH_DAO_KHOA`, `PHONG_DAO_TAO`, `BAN_GIAM_HIEU`, `ADMIN`
- Roles are department-scoped; roles at level >= 4 have global access
- 43 permission codes across modules: `programs.*`, `syllabus.*`, `courses.*`, `portfolio.*`, `rbac.*`

## Middleware Patterns in server.js

- `authMiddleware` — verifies JWT cookie, sets `req.user`
- `requireAdmin()` — factory, blocks non-admins
- `requirePerm(permCode)` — factory, checks RBAC permission; auto-detects `department_id` from route params (`:deptId`, `:id`, `:programId`, `:vId`)
- `requireDraft(vIdParam, requiredPerm)` — factory, calls `checkVersionEditAccess()` which enforces both permission AND approval-step ownership before allowing writes
- `requireViewVersion` — allows viewing based on version status and user role; GIANG_VIEN assigned to a version bypass the check

## API Structure

All routes under `/api/`. Auth via JWT cookie (`token`). File uploads use `multer` with 10 MB limit, memory storage.

Key route groups:
- `POST /api/auth/login`, `GET /api/auth/me` — authentication
- `/api/departments`, `/api/users`, `/api/roles`, `/api/permissions` — RBAC admin (most require `requireAdmin()`)
- `/api/programs`, `/api/programs/:pId/versions` — program & version CRUD
- `/api/programs/:pId/cohorts`, `/api/cohorts/:cId/variants` — cohort/variant management
- `GET/POST /api/versions/:vId/{objectives,plos,courses,assessments,syllabi,knowledge-blocks,teaching-plan}` — version sub-entity CRUD
- `GET/PUT /api/versions/:vId/{po-plo-map,course-plo-map,course-pi-map}` — matrix mappings
- `/api/syllabi/:sId/clos`, `/api/syllabi/:sId/clo-pi-map` — syllabus CLO management
- `/api/courses/:courseId/base-syllabus` — base syllabus CRUD + export
- `/api/versions/:vId/assignments`, `/api/my-assignments` — syllabus assignment to lecturers
- `POST /api/approval/submit`, `POST /api/approval/review` — approval workflow
- `GET /api/approval/pending` — pending items for current user's role
- `/api/notifications` — in-app notification system (unread count, mark read)
- `GET /api/export/version/:vId` (PDF) and `/api/export/version/:vId/docx` — version export
- `POST /api/import/parse-word`, `POST /api/import/save` — Word import workflow
- `GET /api/audit-logs` — audit log viewer (admin only)

## Environment

Config via `.env` file: `JWT_SECRET`, `DB_NAME`, `DB_USER`, `DB_PASS`, `PORT`. Docker compose also sets `DB_HOST` and `DB_PORT`.

## Notes

- The app connects to an external Docker network `canvas_default` for integration with other services
- `backups/` contains compressed SQL backup files
- `docs/specs/` contains change specification documents (used by agent workflows)
- `scripts/smoke-base-syllabus.js` — manual smoke-test script for base syllabus; run with `node scripts/smoke-base-syllabus.js`
- No test framework is configured
- No linter is configured
- `node_modules/` is tracked in git — dep changes produce large diffs that must be committed together with `package.json`/`package-lock.json`
