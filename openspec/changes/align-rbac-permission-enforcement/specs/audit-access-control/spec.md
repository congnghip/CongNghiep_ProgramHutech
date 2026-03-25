## ADDED Requirements

### Requirement: Audit log access requires audit permission
The system MUST require `rbac.view_audit_logs` before returning audit log records from audit log APIs.

#### Scenario: Unauthorized user requests audit logs
- **WHEN** an authenticated user without `rbac.view_audit_logs` requests audit log data
- **THEN** the system denies the request instead of returning log entries

#### Scenario: Authorized user requests audit logs
- **WHEN** an authenticated user with `rbac.view_audit_logs` requests audit log data
- **THEN** the system returns audit log records according to pagination rules

### Requirement: Sensitive operational activity on the dashboard follows audit visibility policy
The system MUST protect dashboard sections that expose audit-derived activity or internal operational telemetry with the same audit visibility policy.

#### Scenario: User lacks audit visibility
- **WHEN** an authenticated user without `rbac.view_audit_logs` requests dashboard data containing recent internal activity
- **THEN** the system omits or denies access to the protected audit-derived activity data
