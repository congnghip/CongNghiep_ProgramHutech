## ADDED Requirements

### Requirement: Import UI spec defines the four-step wizard structure
The system SHALL provide a single spec source that describes the current DOCX import interface as a four-step wizard for the training-program admin workspace.

#### Scenario: Reader reconstructs the wizard flow from the spec
- **WHEN** an AI agent or developer reads the spec
- **THEN** the spec SHALL describe the wizard steps as chọn tệp, phân tích nội dung, kiểm tra dữ liệu, and xác nhận nhập
- **AND** the spec SHALL identify the purpose of each step and the expected UI sections shown in that step

### Requirement: Import UI spec preserves reuse of the ten version tabs
The system SHALL specify that step 2 of the DOCX import workflow reuses the same ten training-program version tabs that exist in the current project UI.

#### Scenario: Reader identifies all tabs required in the import editor
- **WHEN** an AI agent or developer reads the spec for the review and edit stage
- **THEN** the spec SHALL enumerate all ten tabs as Thông tin, Mục tiêu PO, Chuẩn đầu ra PLO, Chỉ số PI, PO - PLO, Học phần, Kế hoạch GD, HP - PLO, Đánh giá CĐR, and Đề cương
- **AND** the spec SHALL state that these tabs are reused from the version-detail workspace rather than redesigned as a different editor model

### Requirement: Import UI spec captures the existing admin visual language
The system SHALL define the visual contract needed for generated or updated import UI to remain consistent with the HUTECH admin workspace.

#### Scenario: Reader derives the visual direction from the spec
- **WHEN** an AI agent or developer uses the spec to design or generate the import interface
- **THEN** the spec SHALL require the HUTECH blue primary color, large rounded white cards, compact uppercase action labels, and a clean enterprise admin appearance
- **AND** the spec SHALL describe the page as visually aligned with the existing workspace and version-detail screens rather than a generic upload wizard

### Requirement: Import UI spec covers validation, commit, and success states
The system SHALL document the user-facing states after parsing, during validation, before commit, and after successful import.

#### Scenario: Reader understands the required state feedback
- **WHEN** an AI agent or developer reads the state-related sections of the spec
- **THEN** the spec SHALL describe summary cards, warning or error banners, per-tab validation indicators, commit confirmation messaging, and the final success actions
- **AND** the spec SHALL require that validation feedback points users back to the affected tab or field context
