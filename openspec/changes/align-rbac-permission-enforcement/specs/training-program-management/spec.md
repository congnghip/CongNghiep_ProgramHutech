## ADDED Requirements

### Requirement: Submitting a training program version requires programs.submit
The system MUST require `programs.submit` before allowing a draft training program version to enter the approval workflow.

#### Scenario: User lacks submit permission
- **WHEN** an authenticated user without `programs.submit` attempts to submit a draft training program version
- **THEN** the system denies the submission request

#### Scenario: User has submit permission
- **WHEN** an authenticated user with `programs.submit` submits a draft training program version that is otherwise valid
- **THEN** the system transitions the version to the submitted state and records the action in approval history

### Requirement: Exporting a training program requires programs.export
The system MUST require `programs.export` before returning exported training program data, in addition to any baseline view checks needed to scope the version.

#### Scenario: User can view but cannot export
- **WHEN** an authenticated user can view a training program version but lacks `programs.export`
- **THEN** the system denies the export request

#### Scenario: User can export
- **WHEN** an authenticated user has `programs.export` for the requested training program scope
- **THEN** the system returns the exported training program payload

### Requirement: programs.manage_all bypasses normal program scoping
The system MUST treat `programs.manage_all` as an explicit all-scope permission for training program management capabilities that are otherwise department-scoped.

#### Scenario: User has manage_all
- **WHEN** an authenticated user with `programs.manage_all` accesses program-management capabilities
- **THEN** the system allows access across department scopes without requiring separate department-bound grants for the same capability
