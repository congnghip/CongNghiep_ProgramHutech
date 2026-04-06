# Flowchart Grid Layout — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**File:** `public/js/pages/course-flowchart.js`

## Problem

The current course flowchart ("So do tien trinh") uses dagre.js for automatic graph layout. Dagre optimizes for general-purpose directed graphs, causing:

1. Courses in later semesters get pushed progressively lower (vertical misalignment between columns)
2. The overall chart becomes very tall, requiring excessive scrolling
3. Invisible anchor nodes (used to enforce semester column ordering) create extra edges that worsen vertical spread

## Solution

Replace dagre auto-layout with a manual grid layout. Each semester becomes a fixed column; courses stack vertically within their column starting from the same top offset.

## Layout Algorithm

### Node positioning

```
X = MARGIN_X + semesterIndex * (NODE_W + GAP_X)
Y = HEADER_HEIGHT + courseIndex * (NODE_H + GAP_Y)
```

- Group courses by `semester` field (0 = "Chua xep")
- Sort semesters numerically ascending
- Within each semester, preserve existing course order (by id)
- All columns share the same top offset (`HEADER_HEIGHT`) — no vertical drift

### Constants (reuse existing where possible)

- `NODE_W: 160` (existing)
- `NODE_H: 52` (existing)
- `GAP_X: 80` (was `NODE_GAP_X`, reuse)
- `GAP_Y: 16` (was `NODE_GAP_Y`, reuse)
- `MARGIN_X: 20`
- `HEADER_HEIGHT: 32` (space for "HK N" labels)

### Canvas dimensions

```
totalW = MARGIN_X + numSemesters * (NODE_W + GAP_X)
totalH = HEADER_HEIGHT + maxCoursesInAnySemester * (NODE_H + GAP_Y)
```

## Edge Drawing

Keep the existing bezier curve approach from `renderArrow()`:

- **Cross-column edges** (prerequisite/corequisite between different semesters): cubic bezier from right edge of source node to left edge of target node, with control points at horizontal midpoint
- **Same-column edges** (corequisite within same semester): curve that arcs outside the column (to the right) and back, to avoid overlapping with nodes

Arrow markers and dash styles remain unchanged:
- Prerequisite: solid blue line with blue arrowhead
- Corequisite: dashed orange line with orange arrowhead

## What Changes

### Remove

- `computeLayout()` method — dagre graph construction, invisible anchor nodes, dagre.layout() call
- dagre.js dependency (script tag in `index.html` if present)

### Replace

- New `computeLayout()` that returns node positions via simple grid math (no external library)
- Update `renderFlowchart()` to use new position data structure
- Update `renderSemesterHeaders()` to use grid-based X positions
- Update `renderNode()` to use grid positions instead of dagre node lookup
- Update `renderArrow()` to use grid positions instead of dagre node lookup; add same-column edge routing

### Keep unchanged

- `renderToolbar()` — zoom buttons, mode buttons
- `renderLegend()` — prerequisite/corequisite legend
- `setMode()`, `updateToolbarState()` — mode management
- `onNodeClick()`, `onArrowClick()` — interaction handlers
- `createRelation()` — API call to save relations
- `zoom()`, `resetZoom()` — zoom controls
- ESC key handler

## Edge Cases

- **Semester 0** ("Chua xep"): rendered as the leftmost column, labeled "Chua xep" instead of "HK N"
- **Empty semesters**: skip columns with no courses (don't leave blank gaps)
- **Many courses in one semester**: the column simply grows taller; total canvas height adapts via `maxCoursesInAnySemester`
- **No prerequisite/corequisite relationships**: just nodes in columns, no arrows — works fine

## Testing

- Import the NNTQ2025 Word document and verify the flowchart tab shows courses in aligned columns
- Verify adding/deleting prerequisite and corequisite edges still works
- Verify zoom controls work
- Verify the chart is significantly shorter (less scrolling) than before
