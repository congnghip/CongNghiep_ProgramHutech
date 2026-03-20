# Proposal: Refactor Permission Matrix UI

## Goal
Improve the readability and aesthetics of the RBAC Permission Matrix in the administration panel.

## Key Changes
1. **Horizontal Role Headers**: Role names will be displayed horizontally (0 degrees) instead of vertical. Layout adjustments will ensure names do not overlap.
2. **Permission Descriptions**: Display the full description of each permission instead of the technical code (e.g., "Tạo mới CTĐT" instead of `create`).
3. **Module-based Styling**: Each permission group (Module) will have a distinct, subtle background color highlight to improve visual scanning.
4. **Enhanced Interactivity**: Add hover highlights for both rows and columns to improve accuracy when toggling permissions.

## UI/UX Design Details
- **Headers**: Use `white-space: normal` and appropriate `min-width` for role columns.
- **Color Palette**:
    - `CTĐT`: Blue tint
    - `PLO`: Green tint
    - `Syllabus`: Orange tint
    - `Courses`: Purple tint
    - `System`: Gray tint
- **Hover Effect**: Implement CSS classes to highlight the entire column when a checkbox is focused or hovered.

## Implementation Plan
1. Update `public/js/pages/rbac-admin.js`:
    - Refactor `renderPermMatrixTab` to remove vertical writing mode.
    - Update permission labels to use descriptions.
    - Add logic for module-specific colors.
2. Update `public/css/styles.css`:
    - Add helper classes for matrix highlights and module colors.
