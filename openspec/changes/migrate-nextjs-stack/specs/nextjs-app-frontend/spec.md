## ADDED Requirements

### Requirement: SSO session verification matches existing hpcore pattern
The system SHALL authenticate users via the shared `account.hpcore.vn` session cookie, verified server-side against the `hpcons-portal` Firebase project using the Firebase Admin SDK, and SHALL read the user's per-app role from `app_permissions/{uid}.warehouse`, matching the pattern already implemented in `hpcons-quatang`, `pkd_crm-next`, and `ITAsset`.

#### Scenario: User already logged into another hpcore app
- **WHEN** a user with a valid `account.hpcore.vn` session cookie opens `khoct.hpcore.vn`
- **THEN** they are recognized as logged in without needing to log in again, and their `warehouse` app role/permissions are loaded from `app_permissions`

### Requirement: All existing pages are reachable with equivalent behavior
The system SHALL provide a Next.js App Router page for every page currently in `frontend/src/pages/**` (Dashboard, Công trình, Danh mục, Phiếu nhập/xuất, Tồn kho, Báo cáo, Ghi chú, Nhật ký, Cài đặt, Nhà cung cấp, Cảnh báo, Phân quyền, AI Reader, Import Data, Lịch sử giao dịch, and the per-công-trình `ct/*` variants), preserving the same navigation structure and business behavior visible to the user.

#### Scenario: Thủ kho navigates the app after migration
- **WHEN** a thủ kho user who used the app before migration opens it after cutover
- **THEN** every page and action they previously used (tạo phiếu, xem tồn kho, xem danh mục, ghi chú, ...) is still present and behaves the same way

### Requirement: PDF splitting is migrated last, behind explicit verification
The system SHALL NOT cut over the AI-assisted PDF splitting feature (currently `api/pdf_splitter.py`, using `pymupdf`/`pypdf`) to its Next.js/Node reimplementation until output has been verified to match the existing Python implementation on real sample PDFs.

#### Scenario: PDF splitting output comparison before cutover
- **WHEN** the Node reimplementation of PDF splitting is ready for a given batch of test PDFs
- **THEN** its output (number of split files, page boundaries, detected phiếu metadata) is compared against the existing Python implementation's output for the same PDFs before the feature is cut over in production

### Requirement: Rollback path is preserved during migration
The system SHALL keep the existing Python/Vite implementation available on a separate git branch, undeleted, until the Next.js implementation has run in production without incident for a period agreed with Sếp.

#### Scenario: Critical issue found shortly after cutover
- **WHEN** a critical bug is discovered in the Next.js implementation shortly after production cutover
- **THEN** the previous Python/Vite implementation can be redeployed to the same Vercel project as a rollback, without needing to reconstruct it from scratch
