## ADDED Requirements

### Requirement: Every seeded permission must have an explicit enforcement status
The system MUST classify every seeded permission in the role matrix as either backend-enforced, mapped through an approved backend policy, or dormant.

#### Scenario: Reviewing the seeded permission matrix
- **WHEN** maintainers audit the 37 seeded permissions
- **THEN** each permission is assigned a documented status and corresponding enforcement expectation

### Requirement: Active permissions must not rely on frontend-only hiding
The system MUST NOT treat frontend menu hiding, button hiding, or tab hiding as the only enforcement mechanism for any active permission.

#### Scenario: Permission is marked active in the matrix
- **WHEN** a permission is considered active for a user-facing capability
- **THEN** the backend enforces the capability through the same permission code or an explicitly documented backend mapping

### Requirement: Dormant permissions must be documented as inactive capabilities
The system MUST document dormant permissions as inactive placeholders until their corresponding capability is implemented or archived.

#### Scenario: Permission exists without a live capability
- **WHEN** a seeded permission has no backend-enforced route or approved capability contract
- **THEN** the system documents that permission as dormant instead of implying that it is currently usable
