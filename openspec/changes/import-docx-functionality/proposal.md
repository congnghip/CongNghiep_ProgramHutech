## Why

Manual data entry of training programs is error-prone and time-consuming. Automating the extraction of curriculum data from DOCX documents ensures consistency with established university formats and significantly improves efficiency for administrative staff by leveraging existing parsing logic.

## What Changes

- **New DOCX Import UI**: A dedicated upload interface for DOCX files within the Training Program management section.
- **Parser Integration**: Integration of the existing Python-based parser (`nguon/py`) to handle document extraction.
- **Structured Data Mapping**: Mapping extracted data to the "Training Program" form fields (Program Code, Faculty, Degree Level, Names, and supplementary fields like Awarding Institution).
- **Validation Engine**: Real-time validation of extracted data against program constraints (e.g., regex for Program Code, max length for names).

## Capabilities

### New Capabilities
- `docx-import`: Upload, parse, and validate DOCX files to extract structured training program data for system ingestion.

### Modified Capabilities
<!-- No existing capabilities listed in openspec/specs/ -->

## Impact

- **Frontend**: Addition of an "Import from DOCX" button and upload modal on the Programs page.
- **Backend**: New endpoint to handle file uploads and trigger the Python parser.
- **Integration**: Dependency on the existing `nguon/py` logic for parsing and validation.
