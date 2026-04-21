# 3-Tier Program Hierarchy (Ngành / Khóa / CTDT Variant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 2-tier `programs → program_versions` model into a 3-tier `programs → program_cohorts → program_versions` hierarchy where each cohort (Khóa) can contain multiple independent CTDT variants (ĐHCQ, Quốc Tế, Việt-Hàn, Việt-Nhật).

**Architecture:** A new `program_cohorts` table groups `(program_id, academic_year)` pairs. `program_versions` gains `cohort_id` and `variant_type` columns. All existing content tables (PLOs, courses, syllabi, etc.) continue to FK into `version_id` — unchanged. Migration is idempotent and runs inside `initDB()`.

**Tech Stack:** Node.js, Express.js, PostgreSQL 15, vanilla JS (no framework), `pg` pool.

**Design spec:** `docs/superpowers/specs/2026-04-21-cohort-variant-hierarchy-design.md`

---

## File Map

| File | Change |
|------|--------|
| `db.js` | Add `program_cohorts` table, 5-step migration in `initDB()` |
| `server.js` | Add 6 cohort routes; update `POST /api/programs/:pId/versions` to accept `cohort_id` + `variant_type`; update `GET /api/versions/:id` response to include `cohort_id`, `variant_type`, `cohort_academic_year` |
| `public/js/pages/programs.js` | Replace `viewVersions()` with `viewCohorts()` + inline cohort detail panel showing variant slots |
| `public/js/pages/version-editor.js` | Update breadcrumb to show `Ngành › Khóa YYYY › VariantLabel` |
| `public/js/pages/import-word.js` | Add `variant_type` dropdown in review step; update save payload to pass `variant_type` |

---

## Phase 1 — Schema + Migration + Backend Routes

### Task 1: Add `program_cohorts` table and migration to `db.js`

**Files:**
- Modify: `db.js` — inside `initDB()`, in the `CREATE TABLE IF NOT EXISTS` block and then after it

- [ ] **Step 1: Add `program_cohorts` CREATE TABLE and ALTER TABLE statements**

In `db.js`, inside the big SQL string in `initDB()` (after the existing `audit_logs` table), append:

```sql
-- Program Cohorts (Khóa — groups a program + academic year)
CREATE TABLE IF NOT EXISTS program_cohorts (
  id            SERIAL PRIMARY KEY,
  program_id    INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  academic_year VARCHAR(4) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, academic_year)
);

-- Add cohort_id and variant_type to program_versions
ALTER TABLE program_versions
  ADD COLUMN IF NOT EXISTS cohort_id INT REFERENCES program_cohorts(id) ON DELETE CASCADE;

ALTER TABLE program_versions
  ADD COLUMN IF NOT EXISTS variant_type VARCHAR(20)
    CHECK (variant_type IN ('DHCQ','QUOC_TE','VIET_HAN','VIET_NHAT'));
```

- [ ] **Step 2: Add the 4 idempotent backfill migration queries**

After the `await client.query(` block for the academic_year normalization migration (around line 392), add these 4 new migration steps:

```js
// Migration: backfill program_cohorts from existing (program_id, academic_year) pairs
await client.query(`
  INSERT INTO program_cohorts (program_id, academic_year)
  SELECT DISTINCT program_id, academic_year
  FROM program_versions
  WHERE cohort_id IS NULL
  ON CONFLICT (program_id, academic_year) DO NOTHING
`);

// Migration: backfill cohort_id on program_versions
await client.query(`
  UPDATE program_versions pv
  SET cohort_id = pc.id
  FROM program_cohorts pc
  WHERE pc.program_id = pv.program_id
    AND pc.academic_year = pv.academic_year
    AND pv.cohort_id IS NULL
`);

// Migration: backfill variant_type — all existing rows become DHCQ
await client.query(`
  UPDATE program_versions
  SET variant_type = 'DHCQ'
  WHERE variant_type IS NULL
`);

// Migration: create unique index (cohort_id, variant_type) — idempotent
await client.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_cohort_variant
  ON program_versions(cohort_id, variant_type)
  WHERE cohort_id IS NOT NULL AND variant_type IS NOT NULL
`);
```

- [ ] **Step 3: Start the app and verify migration runs cleanly**

```bash
make dev
```

Expected: `✅ Database schema initialized` in logs, no errors. Check the DB:

```bash
make db-shell
# then in psql:
\d program_cohorts
SELECT COUNT(*) FROM program_cohorts;
SELECT COUNT(*) FROM program_versions WHERE cohort_id IS NULL;
# Should be 0
SELECT COUNT(*) FROM program_versions WHERE variant_type IS NULL;
# Should be 0
```

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "feat: add program_cohorts table and migration backfill"
```

---

### Task 2: Add cohort routes to `server.js` — read-only endpoints

**Files:**
- Modify: `server.js` — add routes after `DELETE /api/versions/:id` (around line 836)

- [ ] **Step 1: Add `GET /api/programs/:pId/cohorts`**

Add after the existing `DELETE /api/versions/:id` route:

```js
// ============ COHORT ROUTES ============
const VARIANT_LABELS = {
  DHCQ: 'Đại học Chính quy',
  QUOC_TE: 'Quốc Tế',
  VIET_HAN: 'Việt - Hàn',
  VIET_NHAT: 'Việt - Nhật',
};

// GET /api/programs/:pId/cohorts — list cohorts for a program
app.get('/api/programs/:pId/cohorts', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    const progRes = await pool.query('SELECT department_id FROM programs WHERE id=$1', [req.params.pId]);
    if (!progRes.rows.length) return res.status(404).json({ error: 'CTĐT không tồn tại' });
    const deptId = progRes.rows[0].department_id;

    if (!admin) {
      const canView = await hasPermission(req.user.id, 'programs.view_published', deptId) ||
                      await hasPermission(req.user.id, 'programs.view_draft', deptId);
      if (!canView) return res.status(403).json({ error: 'Không có quyền xem' });
    }

    const result = await pool.query(`
      SELECT pc.*,
             json_agg(
               json_build_object(
                 'id', pv.id,
                 'variant_type', pv.variant_type,
                 'variant_label', CASE pv.variant_type
                   WHEN 'DHCQ' THEN 'Đại học Chính quy'
                   WHEN 'QUOC_TE' THEN 'Quốc Tế'
                   WHEN 'VIET_HAN' THEN 'Việt - Hàn'
                   WHEN 'VIET_NHAT' THEN 'Việt - Nhật'
                   ELSE pv.variant_type
                 END,
                 'status', pv.status,
                 'is_locked', pv.is_locked,
                 'is_rejected', pv.is_rejected,
                 'completion_pct', pv.completion_pct
               ) ORDER BY pv.variant_type
             ) FILTER (WHERE pv.id IS NOT NULL) as variants
      FROM program_cohorts pc
      LEFT JOIN program_versions pv ON pv.cohort_id = pc.id
      WHERE pc.program_id = $1
      GROUP BY pc.id
      ORDER BY pc.academic_year DESC
    `, [req.params.pId]);

    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Add `GET /api/cohorts/:cId` and `GET /api/cohorts/:cId/variants`**

```js
// GET /api/cohorts/:cId — cohort detail + variants
app.get('/api/cohorts/:cId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pc.*,
             json_agg(
               json_build_object(
                 'id', pv.id,
                 'variant_type', pv.variant_type,
                 'status', pv.status,
                 'is_locked', pv.is_locked,
                 'is_rejected', pv.is_rejected,
                 'completion_pct', pv.completion_pct,
                 'copied_from_id', pv.copied_from_id
               ) ORDER BY pv.variant_type
             ) FILTER (WHERE pv.id IS NOT NULL) as variants
      FROM program_cohorts pc
      LEFT JOIN program_versions pv ON pv.cohort_id = pc.id
      WHERE pc.id = $1
      GROUP BY pc.id
    `, [req.params.cId]);

    if (!result.rows.length) return res.status(404).json({ error: 'Khóa không tồn tại' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/cohorts/:cId/variants — flat list of variants
app.get('/api/cohorts/:cId/variants', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pv.* FROM program_versions pv WHERE pv.cohort_id = $1 ORDER BY pv.variant_type`,
      [req.params.cId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Verify routes work**

```bash
# With the app running, login as admin and test:
curl -s -b "token=<your_token>" http://localhost:3600/api/programs/1/cohorts | jq .
# Should return array of cohorts with variants array
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add GET cohort routes (/api/programs/:pId/cohorts, /api/cohorts/:cId)"
```

---

### Task 3: Add cohort create/delete and variant create routes to `server.js`

**Files:**
- Modify: `server.js` — add after the GET cohort routes from Task 2

- [ ] **Step 1: Add `POST /api/programs/:pId/cohorts` (create cohort)**

```js
// POST /api/programs/:pId/cohorts — create a new cohort
app.post('/api/programs/:pId/cohorts', authMiddleware, requirePerm('programs.create_version'), async (req, res) => {
  const { academic_year, notes } = req.body;
  if (!academic_year || !/^\d{4}$/.test(academic_year)) {
    return res.status(400).json({ error: 'academic_year phải là 4 chữ số (VD: 2026)' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO program_cohorts (program_id, academic_year, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.pId, academic_year, notes || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: `Khóa "${academic_year}" đã tồn tại cho CTĐT này` });
    }
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Add `DELETE /api/cohorts/:cId` (delete cohort — only when all variants are draft or absent)**

```js
// DELETE /api/cohorts/:cId — delete cohort (only if all variants are draft or cohort is empty)
app.delete('/api/cohorts/:cId', authMiddleware, requirePerm('programs.delete_draft'), async (req, res) => {
  try {
    const cohort = await pool.query('SELECT * FROM program_cohorts WHERE id=$1', [req.params.cId]);
    if (!cohort.rows.length) return res.status(404).json({ error: 'Khóa không tồn tại' });

    const nonDraft = await pool.query(
      `SELECT id FROM program_versions WHERE cohort_id=$1 AND status != 'draft'`,
      [req.params.cId]
    );
    if (nonDraft.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa khóa khi có variant không phải bản nháp' });
    }

    // CASCADE deletes all draft variants (via ON DELETE CASCADE on program_versions.cohort_id)
    await pool.query('DELETE FROM program_cohorts WHERE id=$1', [req.params.cId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add `POST /api/cohorts/:cId/variants` (create variant in cohort)**

This route replaces the role of `POST /api/programs/:pId/versions` for new-model data. It creates a `program_versions` row tied to a `cohort_id` + `variant_type`, then runs the same copy logic as the existing POST versions route.

Add after the DELETE cohort route. The copy logic is extracted inline (same as `POST /api/programs/:pId/versions`):

```js
// POST /api/cohorts/:cId/variants — create a variant inside a cohort
app.post('/api/cohorts/:cId/variants', authMiddleware, requirePerm('programs.create_version'), async (req, res) => {
  const { variant_type, copy_from_version_id, version_name, total_credits, training_duration,
    change_type, effective_date, change_summary, grading_scale, graduation_requirements,
    job_positions, further_education, reference_programs, training_process,
    admission_targets, admission_criteria } = req.body;

  const VALID_VARIANTS = ['DHCQ', 'QUOC_TE', 'VIET_HAN', 'VIET_NHAT'];
  if (!variant_type || !VALID_VARIANTS.includes(variant_type)) {
    return res.status(400).json({ error: `variant_type phải là một trong: ${VALID_VARIANTS.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cohortRes = await client.query('SELECT * FROM program_cohorts WHERE id=$1', [req.params.cId]);
    if (!cohortRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Khóa không tồn tại' });
    }
    const cohort = cohortRes.rows[0];

    // Check duplicate variant in this cohort
    const dup = await client.query(
      'SELECT id FROM program_versions WHERE cohort_id=$1 AND variant_type=$2',
      [req.params.cId, variant_type]
    );
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Variant "${variant_type}" đã tồn tại trong khóa này` });
    }

    // Validate copy source: must have same variant_type
    if (copy_from_version_id) {
      const srcVer = await client.query(
        'SELECT status, variant_type FROM program_versions WHERE id=$1',
        [copy_from_version_id]
      );
      if (!srcVer.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Phiên bản nguồn không tồn tại' });
      }
      if (srcVer.rows[0].status !== 'published') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Chỉ có thể nhân bản từ phiên bản đã công bố' });
      }
      if (srcVer.rows[0].variant_type !== variant_type) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Phiên bản nguồn phải cùng variant_type (${variant_type})` });
      }
    }

    // Insert new version
    const ver = await client.query(
      `INSERT INTO program_versions
         (program_id, cohort_id, academic_year, variant_type, copied_from_id, version_name,
          total_credits, training_duration, change_type, effective_date, change_summary,
          grading_scale, graduation_requirements, job_positions, further_education,
          reference_programs, training_process, admission_targets, admission_criteria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [cohort.program_id, req.params.cId, cohort.academic_year, variant_type,
       copy_from_version_id || null, version_name || null, total_credits || null,
       training_duration || null, change_type || null, effective_date || null,
       change_summary || null, grading_scale || null, graduation_requirements || null,
       job_positions || null, further_education || null, reference_programs || null,
       training_process || null, admission_targets || null, admission_criteria || null]
    );
    const newVersionId = ver.rows[0].id;

    if (copy_from_version_id) {
      // Lock source
      await client.query('UPDATE program_versions SET is_locked=true WHERE id=$1', [copy_from_version_id]);

      // Copy POs
      await client.query(`
        INSERT INTO version_objectives (version_id, code, description)
        SELECT $1, code, description FROM version_objectives WHERE version_id=$2
      `, [newVersionId, copy_from_version_id]);

      // Copy PLOs + PIs
      const oldPlos = await client.query('SELECT * FROM version_plos WHERE version_id=$1', [copy_from_version_id]);
      const ploMap = {};
      for (const oldPlo of oldPlos.rows) {
        const newPlo = await client.query(
          'INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1,$2,$3,$4) RETURNING id',
          [newVersionId, oldPlo.code, oldPlo.bloom_level, oldPlo.description]
        );
        ploMap[oldPlo.id] = newPlo.rows[0].id;
        await client.query(`
          INSERT INTO plo_pis (plo_id, pi_code, description)
          SELECT $1, pi_code, description FROM plo_pis WHERE plo_id=$2
        `, [newPlo.rows[0].id, oldPlo.id]);
      }

      // Copy version_courses
      const oldCourses = await client.query('SELECT * FROM version_courses WHERE version_id=$1', [copy_from_version_id]);
      for (const oc of oldCourses.rows) {
        await client.query(
          'INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1,$2,$3,$4)',
          [newVersionId, oc.course_id, oc.semester, oc.course_type]
        );
      }

      // Copy syllabi
      await client.query(`
        INSERT INTO version_syllabi (version_id, course_id, author_id, status, content)
        SELECT $1, course_id, NULL, 'draft', content FROM version_syllabi WHERE version_id=$2
      `, [newVersionId, copy_from_version_id]);

      // Copy knowledge blocks (preserving hierarchy)
      const oldBlocks = await client.query(
        'SELECT * FROM knowledge_blocks WHERE version_id=$1 ORDER BY sort_order, id',
        [copy_from_version_id]
      );
      const blockMap = {};
      for (const ob of oldBlocks.rows) {
        const newParentId = ob.parent_id ? (blockMap[ob.parent_id] || null) : null;
        const nb = await client.query(
          `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, total_credits, required_credits, elective_credits, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [newVersionId, ob.name, newParentId, ob.level || 1, ob.total_credits, ob.required_credits, ob.elective_credits, ob.sort_order]
        );
        blockMap[ob.id] = nb.rows[0].id;
      }

      // Update knowledge_block_id for copied version_courses
      const newVCs = await client.query('SELECT id, course_id FROM version_courses WHERE version_id=$1', [newVersionId]);
      for (const nvc of newVCs.rows) {
        const oldVC = oldCourses.rows.find(oc => oc.course_id === nvc.course_id);
        if (oldVC && oldVC.knowledge_block_id && blockMap[oldVC.knowledge_block_id]) {
          await client.query('UPDATE version_courses SET knowledge_block_id=$1 WHERE id=$2',
            [blockMap[oldVC.knowledge_block_id], nvc.id]);
        }
      }
    } else {
      // Seed default knowledge blocks
      const gddc = await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức giáo dục đại cương', NULL, 1, 1) RETURNING id`,
        [newVersionId]
      );
      const gdcn = await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức giáo dục chuyên nghiệp', NULL, 1, 2) RETURNING id`,
        [newVersionId]
      );
      await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức bắt buộc', $2, 2, 3)`,
        [newVersionId, gdcn.rows[0].id]
      );
      await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức tự chọn', $2, 2, 4)`,
        [newVersionId, gdcn.rows[0].id]
      );
      await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức không tích lũy', NULL, 1, 5) RETURNING id`,
        [newVersionId]
      );
    }

    await client.query('COMMIT');
    res.json(ver.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});
```

- [ ] **Step 4: Update `GET /api/versions/:id` to include cohort info**

In the existing `GET /api/versions/:id` handler (around line 766), update the SELECT query to also return `cohort_id`, `variant_type`, and `cohort_academic_year`:

Current query joins `program_versions pv JOIN programs p JOIN departments d`. Change the SELECT line to add:

```js
// Replace the SELECT in GET /api/versions/:id (around line 768-773) with:
const v = await pool.query(`
  SELECT pv.*, p.name as program_name, p.code as program_code, p.degree, p.total_credits,
         p.degree_name, p.training_mode, p.institution,
         p.department_id, d.name as dept_name,
         pc.academic_year as cohort_academic_year
  FROM program_versions pv
  JOIN programs p ON pv.program_id = p.id
  JOIN departments d ON p.department_id = d.id
  LEFT JOIN program_cohorts pc ON pv.cohort_id = pc.id
  WHERE pv.id = $1
`, [req.params.id]);
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add cohort create/delete and variant create routes"
```

---

## Phase 2 — Frontend Navigation

### Task 4: Update `programs.js` — replace version list with cohort list + variant panel

**Files:**
- Modify: `public/js/pages/programs.js`

The key change: `viewVersions(programId, programName)` becomes `viewCohorts(programId, programName)`. The cohort list replaces the version list. Each cohort row is expandable to show its variants as a panel with 4 fixed slots.

- [ ] **Step 1: Replace `viewVersions` with `viewCohorts`**

Find the `viewVersions` method (around line 468) and replace the entire method with:

```js
async viewCohorts(programId, programName) {
  const content = document.getElementById('programs-content');
  content.innerHTML = '<div class="spinner"></div>';

  const cardHeader = content.closest('.card').querySelector('.card-header');
  this._originalHeaderHTML = cardHeader.innerHTML;
  cardHeader.innerHTML = `
    <div class="card-title">Khóa — ${programName}</div>
    ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openCohortModal(${programId})">+ Tạo khóa</button>` : ''}
  `;

  try {
    const cohorts = await fetch(`/api/programs/${programId}/cohorts`).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
    const statusColors = { draft: 'badge-warning', submitted: 'badge-info', approved_khoa: 'badge-info', approved_pdt: 'badge-info', published: 'badge-success' };
    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_khoa: 'Duyệt Khoa ✓', approved_pdt: 'Duyệt PĐT ✓', published: 'Đã công bố' };
    const variantLabels = { DHCQ: 'Đại học Chính quy', QUOC_TE: 'Quốc Tế', VIET_HAN: 'Việt - Hàn', VIET_NHAT: 'Việt - Nhật' };
    const ALL_VARIANTS = ['DHCQ', 'QUOC_TE', 'VIET_HAN', 'VIET_NHAT'];

    const renderVariantSlots = (cohort) => ALL_VARIANTS.map(vt => {
      const v = (cohort.variants || []).find(x => x.variant_type === vt);
      if (!v) {
        return window.App.hasPerm('programs.create_version') ? `
          <div class="tree-node" style="opacity:0.5;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;color:var(--text-muted);">${variantLabels[vt]}</span>
            <button class="btn btn-sm btn-outline-primary" onclick="window.ProgramsPage.openVariantModal(${cohort.id},'${vt}','${programName.replace(/'/g,"\\'")}')">+ Tạo</button>
          </div>` : `<div class="tree-node" style="opacity:0.3;font-size:13px;color:var(--text-muted);">${variantLabels[vt]} — Chưa có</div>`;
      }
      return `
        <div class="tree-node flex-between" style="cursor:pointer;"
             onclick="window.App.navigate('version-editor',{versionId:${v.id}})">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;">${variantLabels[vt]}
              ${v.is_locked ? '<span class="badge badge-danger" style="margin-left:4px;">🔒</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
              <span class="badge ${statusColors[v.status] || 'badge-neutral'}">${statusLabels[v.status] || v.status}</span>
              ${v.is_rejected ? '<span class="badge badge-danger">Từ chối</span>' : ''}
              · ${v.completion_pct || 0}%
            </div>
          </div>
          <div class="flex-row" style="flex-shrink:0;" onclick="event.stopPropagation()">
            ${window.App.hasPerm('programs.delete_draft') && v.status === 'draft' ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="window.ProgramsPage.deleteVariant(${v.id},'${variantLabels[vt]}',${cohort.id},${programId},'${programName.replace(/'/g,"\\'")}')">Xóa</button>` : ''}
          </div>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div class="flex-row mb-4" style="gap:10px;">
        <button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.backToList()">← Quay lại</button>
        <h3 class="section-title">Khóa: ${programName}</h3>
      </div>
      ${cohorts.length === 0
        ? '<div class="empty-state"><div class="icon">📭</div><p>Chưa có khóa nào</p></div>'
        : `<div style="display:grid;gap:12px;">
          ${cohorts.map(c => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
              <div class="flex-between" style="padding:12px 16px;background:var(--bg-secondary);cursor:pointer;"
                   onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
                <div style="font-weight:700;font-size:15px;">Khóa ${c.academic_year}
                  <span class="badge badge-neutral" style="margin-left:8px;">${(c.variants||[]).length} variant</span>
                </div>
                <div class="flex-row" onclick="event.stopPropagation()">
                  ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="window.ProgramsPage.deleteCohort(${c.id},'${c.academic_year}',${programId},'${programName.replace(/'/g,"\\'")}')">Xóa khóa</button>` : ''}
                </div>
              </div>
              <div style="padding:12px 16px;display:grid;gap:8px;">
                ${renderVariantSlots(c)}
              </div>
            </div>
          `).join('')}
        </div>`
      }
    `;
  } catch (e) {
    content.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
  }
},
```

- [ ] **Step 2: Update the onclick in `renderList` to call `viewCohorts` instead of `viewVersions`**

Find in `renderList` (around line 269):
```js
onclick="window.ProgramsPage.viewVersions(${p.id},'${p.name.replace(/'/g,"\\'")}')">
```
Replace with:
```js
onclick="window.ProgramsPage.viewCohorts(${p.id},'${p.name.replace(/'/g,"\\'")}')">
```

- [ ] **Step 3: Update `loadData()` auto-expand logic**

Find in `loadData()` (around line 232):
```js
this.viewVersions(pId, pName);
```
Replace with:
```js
this.viewCohorts(pId, pName);
```

- [ ] **Step 4: Add `deleteVariant` and `deleteCohort` methods**

Add these two methods to the `ProgramsPage` object (after `deleteVersion`):

```js
async deleteVariant(versionId, variantLabel, cohortId, programId, programName) {
  const confirmed = await window.ui.confirm({
    title: 'Xóa CTDT Variant',
    eyebrow: 'Xác nhận thao tác',
    message: `Xóa variant "${variantLabel}"? Thao tác này sẽ xóa toàn bộ nội dung (PLO, học phần, đề cương...).`,
    confirmText: 'Xóa',
    cancelText: 'Hủy',
    tone: 'danger',
    confirmVariant: 'danger'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/versions/${versionId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    window.toast.success(`Đã xóa variant ${variantLabel}`);
    await this.viewCohorts(programId, programName);
  } catch (e) { window.toast.error(e.message); }
},

async deleteCohort(cohortId, year, programId, programName) {
  const confirmed = await window.ui.confirm({
    title: 'Xóa khóa',
    eyebrow: 'Xác nhận thao tác',
    message: `Xóa khóa "${year}" và tất cả các variant bên trong?`,
    confirmText: 'Xóa khóa',
    cancelText: 'Hủy',
    tone: 'danger',
    confirmVariant: 'danger'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/cohorts/${cohortId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    window.toast.success(`Đã xóa khóa ${year}`);
    await this.viewCohorts(programId, programName);
  } catch (e) { window.toast.error(e.message); }
},
```

- [ ] **Step 5: Open app in browser, navigate to Programs, click a program, verify cohort list loads with variant slots**

Navigate to `http://localhost:3600`, open a program — should see cohort list with expandable cohort cards showing 4 variant slots (existing data shows as ĐHCQ, others as "+ Tạo").

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "feat: replace version list with cohort+variant navigation in programs.js"
```

---

### Task 5: Add cohort create modal and variant create modal to `programs.js`

**Files:**
- Modify: `public/js/pages/programs.js`

- [ ] **Step 1: Add `openCohortModal` and `saveCohort` methods**

Add these methods to `ProgramsPage`:

```js
openCohortModal(programId) {
  document.getElementById('ver-edit-modal-title').textContent = 'Tạo khóa mới';
  document.getElementById('ver-edit-id').value = '';
  document.getElementById('ver-edit-program-id').value = programId;
  document.getElementById('ver-edit-program-name').value = '';
  document.getElementById('ver-edit-year').value = `${new Date().getFullYear()}`;
  document.getElementById('ver-edit-name').value = '';
  document.getElementById('ver-edit-copy-group').style.display = 'none';
  document.getElementById('ver-edit-credits').value = '';
  document.getElementById('ver-edit-duration').value = '';
  document.getElementById('ver-edit-change-type').value = '';
  document.getElementById('ver-edit-status').value = 'draft';
  document.getElementById('ver-edit-effective-date').value = '';
  document.getElementById('ver-edit-change-summary').value = '';
  document.getElementById('ver-edit-grading').value = '';
  document.getElementById('ver-edit-graduation').value = '';
  document.getElementById('ver-edit-jobs').value = '';
  document.getElementById('ver-edit-further-edu').value = '';
  document.getElementById('ver-edit-reference').value = '';
  document.getElementById('ver-edit-training-process').value = '';
  document.getElementById('ver-edit-admission-targets').value = '';
  document.getElementById('ver-edit-admission-criteria').value = '';
  document.getElementById('ver-edit-save-btn').textContent = 'Tạo khóa';
  // Store mode in hidden field — 'cohort' means save as cohort only, no variant
  document.getElementById('ver-edit-program-name').value = '__cohort_mode__';
  document.getElementById('ver-edit-modal').classList.add('active');
  App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
},
```

- [ ] **Step 2: Add `openVariantModal` method**

```js
async openVariantModal(cohortId, variantType, programName) {
  const variantLabels = { DHCQ: 'Đại học Chính quy', QUOC_TE: 'Quốc Tế', VIET_HAN: 'Việt - Hàn', VIET_NHAT: 'Việt - Nhật' };
  document.getElementById('ver-edit-modal-title').textContent = `Tạo variant: ${variantLabels[variantType]}`;
  document.getElementById('ver-edit-id').value = '';
  document.getElementById('ver-edit-program-id').value = cohortId;
  document.getElementById('ver-edit-program-name').value = `__variant_mode__:${variantType}`;
  document.getElementById('ver-edit-year').value = '';
  document.getElementById('ver-edit-name').value = '';
  document.getElementById('ver-edit-credits').value = '';
  document.getElementById('ver-edit-duration').value = '';
  document.getElementById('ver-edit-change-type').value = '';
  document.getElementById('ver-edit-status').value = 'draft';
  document.getElementById('ver-edit-effective-date').value = '';
  document.getElementById('ver-edit-change-summary').value = '';
  document.getElementById('ver-edit-grading').value = '';
  document.getElementById('ver-edit-graduation').value = '';
  document.getElementById('ver-edit-jobs').value = '';
  document.getElementById('ver-edit-further-edu').value = '';
  document.getElementById('ver-edit-reference').value = '';
  document.getElementById('ver-edit-training-process').value = '';
  document.getElementById('ver-edit-admission-targets').value = '';
  document.getElementById('ver-edit-admission-criteria').value = '';
  document.getElementById('ver-edit-save-btn').textContent = 'Tạo variant';

  // Show copy dropdown with matching variant from previous cohorts
  document.getElementById('ver-edit-copy-group').style.display = '';
  const sel = document.getElementById('ver-copy-from');
  sel.innerHTML = '<option value="">— Tạo mới trắng —</option>';
  try {
    const cohortRes = await fetch(`/api/cohorts/${cohortId}`).then(r => r.json());
    // Find published versions of same variant_type from OTHER cohorts of the same program
    const allVersions = await fetch(`/api/programs/${cohortRes.program_id}/versions`).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
    const matching = allVersions.filter(v => v.variant_type === variantType && v.status === 'published' && v.cohort_id !== parseInt(cohortId));
    matching.sort((a, b) => b.academic_year.localeCompare(a.academic_year));
    matching.forEach(v => {
      sel.innerHTML += `<option value="${v.id}">Khóa ${v.academic_year} (published)</option>`;
    });
    if (matching.length > 0) sel.value = matching[0].id; // Auto-select most recent
  } catch (e) {}

  document.getElementById('ver-edit-modal').classList.add('active');
  App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
},
```

- [ ] **Step 3: Replace `saveVersionEdit` with `saveCohortOrVersion` dispatcher**

The existing `saveVersionEdit` handled both create and edit. Now we need it to route to cohort create, variant create, or version edit based on the hidden `ver-edit-program-name` field.

Find `saveVersionEdit` method (around line 611) and rename it `saveCohortOrVersion`, replacing the create branch logic:

```js
async saveCohortOrVersion() {
  const id = document.getElementById('ver-edit-id').value;
  const programOrCohortId = document.getElementById('ver-edit-program-id').value;
  const modeFlag = document.getElementById('ver-edit-program-name').value;
  const academic_year = document.getElementById('ver-edit-year').value.trim();

  if (id) {
    // Edit existing version — unchanged logic
    if (!academic_year || !/^\d{4}$/.test(academic_year)) {
      window.toast.error('Số khóa phải có định dạng 4 chữ số (VD: 2026)');
      return;
    }
    const body = this._buildVersionBody();
    try {
      const res = await fetch(`/api/versions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      document.getElementById('ver-edit-modal').classList.remove('active');
      window.toast.success('Đã cập nhật khóa');
      // Reload current view
      if (this._currentProgramId) await this.viewCohorts(this._currentProgramId, this._currentProgramName || '');
    } catch (e) { window.toast.error(e.message); }
    return;
  }

  if (modeFlag === '__cohort_mode__') {
    // Create cohort
    if (!academic_year || !/^\d{4}$/.test(academic_year)) {
      window.toast.error('Số khóa phải có định dạng 4 chữ số (VD: 2026)');
      return;
    }
    try {
      const res = await fetch(`/api/programs/${programOrCohortId}/cohorts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      document.getElementById('ver-edit-modal').classList.remove('active');
      window.toast.success(`Đã tạo khóa ${academic_year}`);
      await this.viewCohorts(parseInt(programOrCohortId), this._currentProgramName || '');
    } catch (e) { window.toast.error(e.message); }
    return;
  }

  if (modeFlag && modeFlag.startsWith('__variant_mode__:')) {
    // Create variant
    const variantType = modeFlag.split(':')[1];
    const copy_from_version_id = document.getElementById('ver-copy-from').value || null;
    const body = { variant_type: variantType, copy_from_version_id: copy_from_version_id ? parseInt(copy_from_version_id) : null, ...this._buildVersionBody() };
    try {
      const res = await fetch(`/api/cohorts/${programOrCohortId}/variants`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      document.getElementById('ver-edit-modal').classList.remove('active');
      window.toast.success(`Đã tạo variant${copy_from_version_id ? ' (đã copy dữ liệu)' : ''}`);
      await this.viewCohorts(this._currentProgramId, this._currentProgramName || '');
    } catch (e) { window.toast.error(e.message); }
    return;
  }
},

_buildVersionBody() {
  return {
    academic_year: document.getElementById('ver-edit-year').value.trim() || null,
    version_name: document.getElementById('ver-edit-name').value.trim() || null,
    total_credits: parseInt(document.getElementById('ver-edit-credits').value) || null,
    training_duration: document.getElementById('ver-edit-duration').value.trim() || null,
    change_type: document.getElementById('ver-edit-change-type').value || null,
    effective_date: document.getElementById('ver-edit-effective-date').value || null,
    change_summary: document.getElementById('ver-edit-change-summary').value.trim() || null,
    grading_scale: document.getElementById('ver-edit-grading').value.trim() || null,
    graduation_requirements: document.getElementById('ver-edit-graduation').value.trim() || null,
    job_positions: document.getElementById('ver-edit-jobs').value.trim() || null,
    further_education: document.getElementById('ver-edit-further-edu').value.trim() || null,
    reference_programs: document.getElementById('ver-edit-reference').value.trim() || null,
    training_process: document.getElementById('ver-edit-training-process').value.trim() || null,
    admission_targets: document.getElementById('ver-edit-admission-targets').value.trim() || null,
    admission_criteria: document.getElementById('ver-edit-admission-criteria').value.trim() || null,
  };
},
```

- [ ] **Step 4: Store `_currentProgramId` and `_currentProgramName` when `viewCohorts` is called**

At the start of `viewCohorts`, add:

```js
this._currentProgramId = programId;
this._currentProgramName = programName;
```

- [ ] **Step 5: Update `openVersionEditModal` to use `saveCohortOrVersion`**

Find in `openVersionEditModal` (around line 604):
```js
App.modalGuard('ver-edit-modal', () => ProgramsPage.saveVersionEdit());
```
Replace with:
```js
App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
```

Also update the `ver-edit-form` submit listener at the top of `render()` (around line 205):
```js
document.getElementById('ver-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await this.saveVersionEdit();  // ← change to:
  await this.saveCohortOrVersion();
});
```

- [ ] **Step 6: Test create cohort and create variant flows in browser**

1. Navigate to a program → click "+ Tạo khóa" → enter year → submit → cohort should appear in list
2. Click "+ Tạo" on an empty variant slot → modal opens with copy dropdown → submit → variant card should appear

- [ ] **Step 7: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "feat: add cohort create modal and variant create modal to programs.js"
```

---

### Task 6: Update breadcrumb in `version-editor.js`

**Files:**
- Modify: `public/js/pages/version-editor.js`

- [ ] **Step 1: Update the breadcrumb nav in `render()`**

The current breadcrumb (around line 79-84) shows: `Chương trình Đào tạo › program_name › academic_year`

Replace those lines with:

```js
const variantLabels = { DHCQ: 'Đại học Chính quy', QUOC_TE: 'Quốc Tế', VIET_HAN: 'Việt - Hàn', VIET_NHAT: 'Việt - Nhật' };
const variantLabel = this.version.variant_type ? (variantLabels[this.version.variant_type] || this.version.variant_type) : '';
const cohortYear = this.version.cohort_academic_year || this.version.academic_year;
```

Then replace the breadcrumb HTML (around line 78-84):

```js
// Replace the <nav class="breadcrumb-nav"> block with:
container.innerHTML = `
  <div class="page-header">
    <nav class="breadcrumb-nav mb-3">
      <a href="#" onclick="event.preventDefault();window.App.navigate('programs')" class="breadcrumb-link">Chương trình Đào tạo</a>
      <span class="breadcrumb-sep">›</span>
      <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{programId:${this.version.program_id},programName:'${(this.version.program_name || '').replace(/'/g, "\\'")}'})" class="breadcrumb-link">${this.version.program_name}</a>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-link" style="cursor:default;">Khóa ${cohortYear}</span>
      ${variantLabel ? `<span class="breadcrumb-sep">›</span><span class="breadcrumb-current">${variantLabel}</span>` : `<span class="breadcrumb-sep">›</span><span class="breadcrumb-current">${cohortYear}</span>`}
    </nav>
```

- [ ] **Step 2: Update the `<h1>` page title to include variant label**

Find around line 87:
```js
<h1 class="page-title">${this.version.academic_year}</h1>
```
Replace with:
```js
<h1 class="page-title">Khóa ${cohortYear}${variantLabel ? ` — ${variantLabel}` : ''}</h1>
```

- [ ] **Step 3: Open any version in the editor and verify breadcrumb shows `Chương trình Đào tạo › [name] › Khóa YYYY › Đại học Chính quy`**

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "feat: update version-editor breadcrumb to show cohort year and variant label"
```

---

## Phase 3 — Import Word Update

### Task 7: Add `variant_type` to Import Word flow

**Files:**
- Modify: `public/js/pages/import-word.js`
- Modify: `server.js` — `POST /api/import/save`

- [ ] **Step 1: Find where import-word.js renders the review/save step and add variant_type dropdown**

Read `public/js/pages/import-word.js` to find the review step HTML (look for the save/confirm button area). Add a `variant_type` select before the save button:

```js
// Find the review step render — look for a div that contains the "Lưu vào hệ thống" or save button.
// Add this input group before the save button:
`<div class="input-group">
  <label>Loại hình đào tạo (Variant) <span class="required-mark">*</span></label>
  <select id="iw-variant-type">
    <option value="DHCQ">Đại học Chính quy</option>
    <option value="QUOC_TE">Quốc Tế</option>
    <option value="VIET_HAN">Việt - Hàn</option>
    <option value="VIET_NHAT">Việt - Nhật</option>
  </select>
</div>`
```

- [ ] **Step 2: Include `variant_type` in the save payload**

Find the `_save()` or equivalent method that calls `POST /api/import/save`. Add to the body:

```js
variant_type: document.getElementById('iw-variant-type')?.value || 'DHCQ',
```

- [ ] **Step 3: Update `POST /api/import/save` in `server.js` to accept `variant_type`**

In `POST /api/import/save` (around line 3609), add `variant_type` to the destructured request body:

```js
const {
  program, version, general_objective,
  objectives, plos, pis,
  poploMatrix, knowledgeBlocks,
  courses, coursePIMatrix,
  teachingPlan, assessmentPlan,
  courseDescriptions,
  department_id,
  existing_program_id,
  variant_type,  // ← add this
} = req.body;
```

Then find the `INSERT INTO program_versions` query (around line 3678) and add `cohort_id` and `variant_type` to the INSERT. Before the INSERT, add:

```js
// Create or find cohort
const cohortInsert = await client.query(
  `INSERT INTO program_cohorts (program_id, academic_year)
   VALUES ($1, $2)
   ON CONFLICT (program_id, academic_year) DO UPDATE SET academic_year=EXCLUDED.academic_year
   RETURNING id`,
  [program_id, academicYear]
);
const cohort_id = cohortInsert.rows[0].id;
```

Then update the INSERT program_versions to include `cohort_id` and `variant_type`:

```js
// Replace the INSERT INTO program_versions VALUES list:
const verRes = await client.query(
  `INSERT INTO program_versions
     (program_id, cohort_id, academic_year, variant_type, version_name, status, total_credits, training_duration,
      grading_scale, graduation_requirements, job_positions, further_education,
      reference_programs, training_process, admission_targets, admission_criteria, general_objective)
   VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
  [
    program_id,
    cohort_id,
    academicYear,
    variant_type || 'DHCQ',
    (version && version.version_name) ? version.version_name : null,
    program.total_credits || null,
    (version && version.training_duration) ? version.training_duration : (program.duration || null),
    (version && version.grading_scale) ? version.grading_scale : null,
    (version && version.graduation_requirements) ? version.graduation_requirements : null,
    (version && version.job_positions) ? version.job_positions : null,
    (version && version.further_education) ? version.further_education : null,
    (version && version.reference_programs) ? version.reference_programs : null,
    (version && version.training_process) ? version.training_process : null,
    (version && version.admission_targets) ? version.admission_targets : null,
    (version && version.admission_criteria) ? version.admission_criteria : null,
    general_objective || null,
  ]
);
```

- [ ] **Step 4: Test import flow end-to-end**

1. Go to Import Word
2. Upload a `.docx` file
3. In the review step, verify the variant dropdown appears (default: ĐHCQ)
4. Click save — verify the new program/version appears in the cohort list with the correct variant slot filled

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/import-word.js server.js
git commit -m "feat: add variant_type to import-word flow and /api/import/save"
```

---

## Phase 4 — Cleanup

### Task 8: Remove old `cloneVersion` method and dead code in `programs.js`

**Files:**
- Modify: `public/js/pages/programs.js`

- [ ] **Step 1: Delete the `cloneVersion` method**

Find and delete the entire `cloneVersion` method (around line 536-554). The new flow uses `openVariantModal` instead.

- [ ] **Step 2: Delete the `deleteVersion` method**

Find and delete the `deleteVersion` method (around line 557-576). The new flow uses `deleteVariant` instead.

- [ ] **Step 3: Delete the `openVersionModal` method**

Find and delete `openVersionModal` (around line 427-465). Replaced by `openCohortModal` + `openVariantModal`.

- [ ] **Step 4: Confirm the app still works after removals**

Navigate through the full flow: Programs → Cohorts → create cohort → create variant → open editor → breadcrumb back.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "refactor: remove legacy cloneVersion/deleteVersion/openVersionModal methods"
```

---

### Task 9: Verify backward compatibility of old routes

**Files:**
- Read: `server.js` — verify `POST /api/programs/:pId/versions` still works (used by no UI after Phase 2, but may be called by tests or manual scripts)

- [ ] **Step 1: Check that `POST /api/programs/:pId/versions` still inserts with NULL cohort_id**

No change needed — the old route still inserts `program_versions` rows. `cohort_id` will be NULL for rows created this way. This is acceptable for backward compat; the migration in `initDB()` does not retroactively fix NULL cohort_ids created after migration (they won't exist in practice since the UI no longer calls this route).

- [ ] **Step 2: Verify `GET /api/programs/:pId/versions` still returns rows with new fields**

Manually hit the endpoint:

```bash
curl -s -b "token=<your_token>" http://localhost:3600/api/programs/1/versions | jq '.[0] | {id, academic_year, cohort_id, variant_type}'
```

Expected: all rows have `cohort_id` (non-null) and `variant_type: "DHCQ"`.

- [ ] **Step 3: Verify approval, dashboard, my-assignments still work**

Navigate to approval and my-assignments pages — no visual changes expected, but verify no JS errors in browser console.

- [ ] **Step 4: Commit if any minor fixes needed**

```bash
git add -p
git commit -m "fix: backward compat checks post cohort-variant refactor"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `program_cohorts` table — Task 1
- ✅ `cohort_id` + `variant_type` on `program_versions` — Task 1
- ✅ 5-step idempotent migration — Task 1
- ✅ GET cohort routes — Task 2
- ✅ POST cohort, DELETE cohort, POST variant routes — Task 3
- ✅ Copy chain (same variant_type, published source) — Task 3
- ✅ Lock source on copy — Task 3 (copy_from_version_id branch)
- ✅ Frontend navigation: Ngành → Khóa → Variants panel — Task 4
- ✅ Create cohort UI — Task 5
- ✅ Create variant UI with copy suggestion — Task 5
- ✅ Delete variant, delete cohort — Task 4
- ✅ Breadcrumb update — Task 6
- ✅ Import Word variant_type — Task 7
- ✅ Backward compat old routes — Task 9
- ⚠️ `academic_year` column removal from `program_versions` — deferred (spec says Phase 4, high risk, no functional impact to keep it)
- ⚠️ Dashboard grouping by cohort — deferred (spec says optional Phase 4)
