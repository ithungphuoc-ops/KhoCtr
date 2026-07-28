## ADDED Requirements

### Requirement: Firestore collections and field names are preserved unchanged
The system SHALL read and write the same Firestore collections and snake_case field names currently used by `api/firestore_client.py` (`cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, `project_ai_config`, `ghi_chu`), without renaming fields or restructuring documents.

#### Scenario: TypeScript data layer reads an existing document
- **WHEN** the Next.js data layer reads a `phieu` document written before the migration
- **THEN** all existing fields (`so_phieu`, `ngay`, `doi_tac`, `tong_tien`, `cong_trinh_id`, `loai`) are read correctly without any transformation of field names

### Requirement: Native prefiltering is preserved for multi-condition queries
The system SHALL use a real Firestore `where()` query to narrow results whenever at least one equality/`in` condition is present in a query with multiple conditions, applying any remaining conditions (e.g. substring search) only to the narrowed result set — matching the fix applied to `_native_prefilter()` in `api/firestore_client.py` on 2026-07-27. It SHALL NOT regress to scanning the full collection when a narrowing condition is available.

#### Scenario: Danh mục filtered by công trình and search text
- **WHEN** a request filters `hang_hoa` by both `cong_trinh_id` and a search term
- **THEN** the system first narrows using a native `where(cong_trinh_id == ...)` query, then filters the search term only within that narrowed set — not by scanning the entire `hang_hoa` collection

### Requirement: Per-table cache TTL is preserved for low-write collections
The system SHALL cache full-collection reads with a longer TTL (at least 60 seconds) for collections that change infrequently (`hang_hoa`, `cong_trinh`, `project_ai_config`), and a shorter TTL (around 8 seconds) for frequently-written collections (`phieu`, `chi_tiet_phieu`), matching the caching behavior introduced in `api/firestore_client.py` on 2026-07-27.

#### Scenario: Repeated catalog page loads hit cache
- **WHEN** a user opens the Danh mục tab multiple times within 60 seconds without any admin edit to `hang_hoa` in between
- **THEN** the second and subsequent loads are served from cache instead of re-reading the full collection

### Requirement: Vercel Function region matches Firestore database region
The system SHALL run its Vercel Functions in the same region as the Firestore database (`asia-southeast1` / Vercel `sin1`), matching the region fix applied on 2026-07-27, to avoid cross-region latency on every request.

#### Scenario: Deployment configuration specifies region
- **WHEN** the Next.js project is deployed
- **THEN** its Vercel configuration declares `regions: ["sin1"]`, consistent with the Firestore database location

### Requirement: compute tồn kho logic is preserved
The system SHALL compute tồn kho (inventory balance) at request time using the same grouping and summation logic as `compute_ton_kho()` in `api/firestore_client.py`: grouping by `(ma_hang hoặc ten_hang, cong_trinh_id)`, summing nhập (`NK`) minus xuất (`XK`) quantities.

#### Scenario: Tồn kho result matches pre-migration value
- **WHEN** tồn kho is computed for a công trình with existing phiếu/chi_tiet_phieu data
- **THEN** the resulting balance per mặt hàng matches the value previously returned by the Python implementation for the same data
