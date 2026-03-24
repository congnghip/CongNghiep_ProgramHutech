## ADDED Requirements

### Requirement: Upload DOCX File
The system SHALL provide a user interface to upload DOCX files containing training program information.

#### Scenario: User selects a file
- **WHEN** the user selects a .docx file from their local storage
- **THEN** the system SHALL display the file name and a button to initiate parsing

### Requirement: Extract Curriculum Data
The system SHALL parse the uploaded DOCX file and extract structured data for the Training Program, including basic information and supplementary details.

#### Scenario: Successful data extraction
- **WHEN** the user initiates parsing on a valid DOCX file
- **THEN** the system SHALL populate the "Training Program" form fields with the extracted data, including Program Code, Vietnamese Name, English Name, Faculty, and Degree Level

### Requirement: Validate Program Code Format
The Program Code SHALL only contain uppercase letters (A-Z), numbers (0-9), and dashes (-).

#### Scenario: Invalid Program Code format
- **WHEN** the extracted or entered Program Code contains lowercase letters or special characters (other than -)
- **THEN** the system SHALL display an inline error message: "Mã chương trình chỉ được chứa chữ in hoa, số và dấu '-'"

### Requirement: Validate Field Lengths
The Vietnamese and English names SHALL NOT exceed 255 characters.

#### Scenario: Vietnamese name too long
- **WHEN** the extracted Vietnamese Name exceeds 255 characters
- **THEN** the system SHALL display an inline error message: "Tên chương trình tối đa 255 ký tự"

### Requirement: Toggle Supplementary Information
Supplementary fields (Awarding Institution, Degree Title, Study Mode, Additional Notes) SHALL be hidden by default and expandable via a toggle button.

#### Scenario: Expand supplementary field
- **WHEN** the user clicks the "+" icon next to a supplementary field label
- **THEN** the system SHALL expand the field to reveal a textarea or rich-text editor, preserving any previously entered or extracted data

#### Scenario: Collapse supplementary field
- **WHEN** the user clicks the "-" or toggle icon on an expanded supplementary field
- **THEN** the system SHALL collapse the field view while retaining the entered data

### Requirement: Required Field Validation
The system SHALL NOT allow form submission if mandatory fields (Program Code, Faculty, Vietnamese Name, English Name) are empty.

#### Scenario: Submit with empty mandatory fields
- **WHEN** the user clicks "Submit" while a mandatory field is empty
- **THEN** the system SHALL prevent submission and highlight the empty fields with inline error messages
