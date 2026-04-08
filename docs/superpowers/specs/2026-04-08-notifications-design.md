# Notification Center Design

**Date:** 2026-04-08

## Goal

Add a notification center for approval work and syllabus authoring assignments. Users should see a bell in the sidebar, know how many unread notifications they have, open a right-side drawer, and jump directly to the related work.

## Requirements

- Add a persistent notification inbox with read/unread state.
- Notify approvers when a CTĐT version or syllabus needs their review.
- Notify submitters/authors when their CTĐT version or syllabus is approved, published, or rejected.
- Notify lecturers when they are assigned to write a syllabus.
- Show the notification entry as a sidebar bell with an unread badge.
- Open notifications in a right-side drawer instead of navigating away from the current page.
- Use lightweight refresh behavior: initial load, refresh after related actions, and polling every 60 seconds.
- Backfill only current open work during deployment, not historical review results.

## Chosen Approach

Use a hybrid model:

1. Store notifications in a new database table.
2. Create notifications from event hooks in assignment and approval flows.
3. Backfill currently actionable assignments and pending approvals.

This keeps read/unread behavior reliable while avoiding a full realtime subsystem.

## Data Model

Add `notifications` in `db.js`:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  entity_type VARCHAR(50),
  entity_id INT,
  link_page VARCHAR(80),
  link_params JSONB DEFAULT '{}',
  dedupe_key VARCHAR(200),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe ON notifications(user_id, dedupe_key);
```

The `(user_id, dedupe_key)` unique index prevents duplicate notifications for the same logical event while still allowing the same approval task to notify multiple reviewers. Example keys:

- `assignment:<assignment_id>:assigned`
- `approval:<entity_type>:<entity_id>:<status>:pending`
- `result:<entity_type>:<entity_id>:<new_status>`

Notification `type` values in the first version:

- `assignment`
- `approval_needed`
- `approval_result`
- `rejection_result`

## Backend API

Add these routes in `server.js`:

- `GET /api/notifications?filter=all|unread|actionable`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

All routes require `authMiddleware`. List and mutation routes only operate on `req.user.id` notifications.

The `actionable` filter returns unread or still-relevant `assignment` and `approval_needed` notifications. Result notifications are informational and appear under `all` or `unread`.

Add helper functions near the approval/assignment workflow:

- `createNotification({ userId, type, title, body, entityType, entityId, linkPage, linkParams, dedupeKey })`
- `notifyApprovalNeeded(entityType, entityId, status)`
- `notifyApprovalResult(entityType, entityId, newStatus, action, notes)`
- `notifySyllabusAssignment(assignmentId)`

## Notification Events

### Syllabus Assignment

When `POST /api/versions/:vId/assignments` creates or reassigns a syllabus assignment:

- Notify the selected lecturer.
- Title: `Bạn được phân công soạn đề cương`
- Link: `my-assignments` with `assignmentId` in `link_params`. The page can highlight or open that assignment when implemented.
- Do not notify the previous lecturer in the first version; this avoids extra noise.

### Submission

When `POST /api/approval/submit` moves an entity to `submitted`:

- Notify users who can approve the next step in the entity department scope.
- Program version `submitted` targets users with `programs.approve_khoa`.
- Syllabus `submitted` targets users with `syllabus.approve_tbm`.
- Link to `version-editor` for CTĐT and `syllabus-editor` for syllabi.

### Approval And Rejection

When `POST /api/approval/review` approves:

- Notify the submitter/author about the new status.
- If the item is not published yet, notify users who can approve the next step.
- If the item becomes `published`, only send the result notification.

When `POST /api/approval/review` rejects:

- Notify the submitter/author.
- Include the rejection reason in the body.
- Do not create another pending-approval notification until the item is submitted again.

## Backfill

Create an idempotent startup helper to add notifications for current open work:

- Open assignments: rows from `syllabus_assignments` where the parent version is not locked and the linked syllabus is not published.
- Pending approvals: CTĐT versions or syllabi in approval statuses (`submitted`, `approved_tbm`, `approved_khoa`, `approved_pdt`) sent to the currently responsible reviewer group.

Do not backfill old approval/rejection results from `approval_logs`.

## Frontend UI

Add a sidebar item in `public/js/app.js` after Tổng quan:

```text
🔔 Thông báo <badge>
```

Behavior:

- Show the unread count badge only when count is greater than zero.
- Clicking the item opens a right-side drawer and does not navigate away.
- The drawer includes:
  - title `Thông báo`
  - filters `Tất cả`, `Chưa đọc`, `Cần xử lý`
  - `Đánh dấu tất cả đã đọc`
  - a list of notification rows with title, body, time, unread marker
- Clicking a notification marks it read, closes the drawer, and navigates to its `link_page` with `link_params`.

Refresh behavior:

- Fetch unread count after login/app init.
- Refresh after assignment, submit, approve, reject, and read actions.
- Poll unread count every 60 seconds while logged in.
- Fetch notification list whenever the drawer opens or filter changes.

## Error Handling

- If notification list fetch fails, show a compact drawer error and keep the app usable.
- If marking as read fails before navigation, still allow navigation but leave the notification unread.
- If a target entity was deleted, route handlers should return their existing not-found behavior. The drawer does not need a special deleted state in the first version.

## Testing

Backend tests or focused integration checks should cover:

- `dedupe_key` prevents duplicate notifications.
- A lecturer receives a notification when assigned to a syllabus.
- Approvers receive pending-review notifications after submission.
- Authors/submitters receive approval, published, and rejection result notifications.
- `GET /api/notifications/unread-count` only counts the current user's unread notifications.
- Mark-one-read and read-all endpoints cannot mutate another user's notifications.

Frontend Playwright coverage should cover:

- Sidebar badge appears when unread notifications exist.
- Clicking the bell opens the drawer.
- Clicking a notification marks it read and navigates to the expected page.
- `Đánh dấu tất cả đã đọc` clears the badge.

## Scope Exclusions

- No WebSocket or server-sent events in the first version.
- No email or push notifications.
- No notification preferences screen.
- No notification for the previous lecturer when an assignment is reassigned.
- No historical backfill for old approval/rejection outcomes.
