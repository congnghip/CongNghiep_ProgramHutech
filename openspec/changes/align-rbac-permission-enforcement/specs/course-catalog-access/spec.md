## ADDED Requirements

### Requirement: Viewing the course catalog requires courses.view
The system MUST require `courses.view` before returning the course catalog to authenticated users.

#### Scenario: User without view permission opens course catalog
- **WHEN** an authenticated user without `courses.view` requests the course list
- **THEN** the system denies the request instead of returning course catalog data

#### Scenario: User with view permission opens course catalog
- **WHEN** an authenticated user with `courses.view` requests the course list
- **THEN** the system returns the course catalog data allowed by the current department and role policy
