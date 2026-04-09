# Inline Approval In Editors Design

**Date:** 2026-04-09

## Goal

Reduce friction when a user opens an approval notification. If a CTDT version or syllabus is currently waiting for that user's approval, the user should be able to approve or reject directly inside the corresponding editor page instead of switching to the Approval page first.

## Problem

The notification center currently sends approval-needed notifications to:

- `version-editor` for CTDT versions
- `syllabus-editor` for syllabi

But the actual review actions only exist on the Approval page. This creates a broken flow:

1. User clicks notification.
2. App opens the correct record.
3. User still has to leave that record and go to `Phê duyệt`.
4. User finds the same record again before taking action.

This makes approval notifications feel incomplete even though they open the right item.

## Requirements

- Keep approval-needed notifications opening the relevant editor page.
- Show inline `Duyệt` and `Từ chối` actions inside `version-editor` and `syllabus-editor`.
- Only show the inline approval block when:
  - the current entity is at an approval step, and
  - the current user has permission to review that exact step.
- Keep the Approval page as the aggregated inbox for pending work.
- Reuse the existing approval API and state machine.
- Apply the same interaction model to both CTDT versions and syllabi.

## Chosen Approach

Add a compact approval action block inside both editor pages and reuse the existing `POST /api/approval/review` endpoint.

This keeps one approval workflow in the backend while removing the extra page hop from notification-driven review work.

## User Experience

### Notification Behavior

When a user clicks an `approval_needed` notification:

- CTDT notifications continue to open `version-editor`
- syllabus notifications continue to open `syllabus-editor`

No notification routing change is required for this design.

### Inline Approval Block

When the opened entity is waiting for the current user's approval, show a compact block near the page header with:

- title `Phê duyệt hồ sơ`
- a short line describing the current review step
- current status badge
- `Duyệt` button
- `Từ chối` button

If the entity is not currently actionable for the user, the block is not shown.

### When The Block Is Hidden

Do not show the block when:

- the entity is still `draft`
- the entity is already `published`
- the entity is `rejected`
- the entity is at an approval step owned by another role
- the current user only has view/edit access but not approval access for the current step

## Permission And Status Rules

### CTDT Versions

Show the inline block only when the current user has the permission matching the current status:

- `submitted` -> `programs.approve_khoa`
- `approved_khoa` -> `programs.approve_pdt`
- `approved_pdt` -> `programs.approve_bgh`

### Syllabi

Show the inline block only when the current user has the permission matching the current status:

- `submitted` -> `syllabus.approve_tbm`
- `approved_tbm` -> `syllabus.approve_khoa`
- `approved_khoa` -> `syllabus.approve_pdt`
- `approved_pdt` -> `syllabus.approve_bgh`

The editor pages should reuse the same status-to-permission mapping semantics already used on the Approval page.

## Frontend Design

### Version Editor

Add a small approval section to `public/js/pages/version-editor.js` close to the header or metadata area.

The block should:

- render only after version data is loaded
- evaluate whether the current user can approve the current version status
- use existing button styles
- avoid overwhelming the editor layout

### Syllabus Editor

Add the same pattern to `public/js/pages/syllabus-editor.js`.

The syllabus version should match the CTDT editor structurally so users do not need to learn two approval experiences.

### Reject Flow

Inline rejection should use the same rejection modal pattern already present on the Approval page:

- open modal
- require notes according to current backend behavior
- submit using the same review endpoint

This avoids divergent rejection rules between pages.

## Data Flow

No new API is needed.

The editor pages should:

1. load entity data as they do today
2. derive whether the current status is approval-actionable for the current user
3. render inline approval controls if actionable
4. call `POST /api/approval/review` on approve or reject
5. reload the editor data after success
6. refresh the notification badge and drawer data if available

## Error Handling

- If another reviewer already handled the item, the approval API should continue returning its current error.
- On approve/reject failure, show a toast and reload the entity state so the page reflects the latest workflow status.
- If the inline approval block disappears after reload, that is correct behavior: the entity is no longer waiting on the current user.

## Approval Page Role

The Approval page remains the centralized queue for all pending review work.

This design does not remove or replace it. Instead:

- `Phê duyệt` stays useful for scanning all pending items
- editor pages become the fast-path when a user enters from a notification or already has the record open

## Testing

Add or extend Playwright coverage for:

- approval-needed notification opens `version-editor`, and the reviewer sees inline `Duyệt` / `Từ chối`
- approval-needed notification opens `syllabus-editor`, and the reviewer sees inline `Duyệt` / `Từ chối`
- users without the current-step approval permission do not see the inline block
- approving from `version-editor` updates status and refreshes notification count
- rejecting from `version-editor` requires notes and updates status correctly
- approving from `syllabus-editor` updates status and refreshes notification count
- rejecting from `syllabus-editor` requires notes and updates status correctly

## Scope Exclusions

- No change to notification routing for approval-needed items
- No replacement of the Approval page
- No new backend approval endpoint
- No side-by-side diff or advanced review mode in editors
- No approval actions for non-actionable statuses
