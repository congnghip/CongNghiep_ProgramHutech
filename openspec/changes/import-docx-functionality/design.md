## Context

The application currently manages training programs through a manual entry form. A Python-based parser (`nguon/py/parser.py`) is available to extract structured curriculum data from DOCX files. This design integrates the parser into the Express.js backend and provides a seamless UI for users to upload and import data.

## Goals / Non-Goals

**Goals:**
- Provide a multi-step import wizard (Upload -> Preview -> Import).
- Integrate existing Python parser into the Node.js backend.
- Automatically populate the Training Program form with extracted data.
- Ensure validation rules (Program Code regex, Name length) are applied to imported data.

**Non-Goals:**
- Automated bulk import of multiple files.
- Modifying the existing Python parser logic (use as-is).

## Decisions

### 1. Backend Integration (Node.js to Python)
- **Decision**: Use `child_process.spawn` to execute a Python wrapper script.
- **Rationale**: Decouples the Node.js process from Python execution and allows passing data via stdout/stderr.
- **Data Flow**: Node.js receives file -> saves temporarily -> spawns Python parser -> receives JSON output -> returns to Frontend.

### 2. Frontend Wizard
- **Decision**: Update the existing `import-docx-modal` to include an `<input type="file">` and handle the upload lifecycle.
- **Rationale**: Enhances UX by showing progress and allowing the user to review extracted data before final submission.

### 3. API Design
- **Endpoint**: `POST /api/import/docx`
- **Payload**: `multipart/form-data` containing the DOCX file.
- **Response**: JSON object containing extracted fields (code, vn_name, en_name, dept_name, etc.).

### 4. Temporary File Handling
- **Decision**: Store uploaded DOCX files in a `temp/` directory and delete them immediately after parsing.
- **Rationale**: Minimizes disk usage and ensures data privacy.

## Risks / Trade-offs

- **[Risk]** Python environment mismatch on server → **[Mitigation]** Define clear requirements in `requirements.txt` and verify Python path in backend config.
- **[Risk]** Large DOCX files causing timeouts → **[Mitigation]** Implement file size limits in Express (e.g., 10MB).
- **[Risk]** Parser failure due to unexpected DOCX format → **[Mitigation]** Return clear error messages to the user and allow manual correction in the form.
