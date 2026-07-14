## ADDED Requirements

### Requirement: Authentication is delegated entirely to hpcore SSO
The system SHALL authenticate users solely via the shared hpcore session cookie (name `session`, domain `.hpcore.vn`), verified server-side using the Firebase Admin SDK for Python with the `HPCORE_FIREBASE_SERVICE_ACCOUNT` credential. The system SHALL NOT provide its own login form, password storage, or JWT issuance.

#### Scenario: User with a valid hpcore session accesses KhoUNICE
- **WHEN** a request to any `/api/*` route includes a valid, unexpired hpcore session cookie
- **THEN** the system verifies it and extracts the user's `uid` and `email`

#### Scenario: Unauthenticated user is redirected to hpcore login
- **WHEN** a request has no session cookie, or the cookie fails verification
- **THEN** the frontend redirects the browser to `account.hpcore.vn/login` with a `next` parameter pointing back to the current KhoUNICE URL

### Requirement: User role is sourced from hpcore's per-app permission system
The system SHALL determine each authenticated user's role (admin or user) by reading the `app_permissions` Firestore collection in the hpcore Firebase project, keyed by the user's hpcore `uid`, rather than maintaining its own role assignment. The system SHALL publish a `GET /api/roles` endpoint (unauthenticated) listing its valid role keys and labels, so hpcore's admin UI can offer them for assignment.

#### Scenario: hpcore fetches KhoUNICE's role list
- **WHEN** an hpcore administrator opens the permission management page for the KhoUNICE app
- **THEN** hpcore calls `GET /api/roles` on KhoUNICE and displays the returned roles for assignment

#### Scenario: Authenticated user has no role assigned
- **WHEN** a user with a valid hpcore session has no entry in `app_permissions` for KhoUNICE
- **THEN** the system denies access with a 403 response indicating the user has not been granted access, and does not default them to any role

#### Scenario: User record is synced locally on login
- **WHEN** a user successfully authenticates and has a role in `app_permissions`
- **THEN** the system upserts a local `app_users` record (email, display name, role) so the existing `/phan-quyen` (công trình assignment) page can list them without manual account creation

### Requirement: Công trình-level permission remains managed locally
The system SHALL continue to manage which công trình each non-admin user can access via its existing `user_congtrinh` table and `/phan-quyen` page, since this is data specific to KhoUNICE that hpcore's generic per-app role does not cover. Admin users continue to see all công trình.

#### Scenario: Admin assigns công trình to a user
- **WHEN** an admin uses the `/phan-quyen` page to grant a user access to specific công trình
- **THEN** that user's subsequent requests are scoped to only those công trình, unchanged from current behavior

## REMOVED Requirements

### Requirement: Local email/password login
**Reason**: Replaced by hpcore SSO — KhoUNICE no longer issues or verifies its own credentials.
**Migration**: Existing `app_users.password_hash` values are no longer read or written; the column is retained but unused.

### Requirement: Manual user account creation and password reset (NguoiDung.jsx)
**Reason**: With no local password, there is nothing to create or reset. User records are now synced automatically from hpcore on first login (see "User record is synced locally on login").
**Migration**: The `NguoiDung.jsx` page and its backend endpoints (`create-user`, `reset-password`) are removed. `/phan-quyen` (which lists users to assign công trình) continues to work off the auto-synced `app_users` records.
