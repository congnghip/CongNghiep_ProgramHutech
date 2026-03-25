## ADDED Requirements

### Requirement: Starting a DOCX import requires programs.import_word
The system MUST require `programs.import_word` before allowing a user to start a DOCX-based training program import session.

#### Scenario: User without import permission starts import
- **WHEN** an authenticated user without `programs.import_word` uploads a DOCX file to create an import session
- **THEN** the system denies the request

#### Scenario: User with import permission starts import
- **WHEN** an authenticated user with `programs.import_word` uploads a DOCX file to create an import session
- **THEN** the system creates the import session and returns the parsed draft data

### Requirement: Completing a DOCX import follows the import permission contract
The system MUST require the same import capability contract for commit operations created through the DOCX import workflow instead of inheriting permission from generic program creation alone.

#### Scenario: User commits an owned import session
- **WHEN** an authenticated user with `programs.import_word` commits an import session they are allowed to access
- **THEN** the system persists the imported training program data
