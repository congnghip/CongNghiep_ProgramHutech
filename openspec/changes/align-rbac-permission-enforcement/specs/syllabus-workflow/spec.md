## ADDED Requirements

### Requirement: Viewing syllabus content follows syllabus.view semantics
The system MUST require `syllabus.view` for role-based syllabus visibility, while still allowing explicitly assigned lecturers to access the syllabi they are assigned to work on.

#### Scenario: Role-based syllabus access
- **WHEN** an authenticated user accesses syllabus content through role-based visibility
- **THEN** the system checks `syllabus.view` for the relevant scope before returning syllabus content

#### Scenario: Assigned lecturer accesses assigned syllabus
- **WHEN** an assigned lecturer accesses a syllabus they are assigned to author or edit
- **THEN** the system allows access even if the lecturer is not relying on broader department-wide syllabus browsing

### Requirement: Creating a syllabus requires syllabus.create
The system MUST require `syllabus.create` before creating a new syllabus record for a versioned course.

#### Scenario: User lacks create permission
- **WHEN** an authenticated user without `syllabus.create` attempts to create a syllabus
- **THEN** the system denies the creation request

#### Scenario: User has create permission
- **WHEN** an authenticated user with `syllabus.create` creates a syllabus in an editable version scope
- **THEN** the system creates the syllabus and associates the creator as the initial author

### Requirement: Editing an existing syllabus remains governed by syllabus.edit
The system MUST continue to require `syllabus.edit` or assignment-based edit authority before changing existing syllabus content.

#### Scenario: Existing syllabus is modified
- **WHEN** an authenticated user edits an existing syllabus
- **THEN** the system enforces `syllabus.edit` or the assignment-based edit rule defined by the workflow
