## ADDED Requirements

### Requirement: All data reads and writes go through Firebase Admin SDK on the server
The system SHALL perform all Firestore reads and writes from server-side backend code (FastAPI routers running as Vercel Functions) using the Firebase Admin SDK. No frontend code SHALL call Firestore directly from the browser.

#### Scenario: Frontend needs kho data
- **WHEN** a page needs to display công trình, phiếu, hàng hóa, or tồn kho data
- **THEN** the data is fetched via the existing `/api/*` backend routes, which read Firestore server-side — not by client-side Firestore calls

### Requirement: Existing table names and field names are preserved as Firestore collections
The system SHALL map each existing Postgres table (`cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, `project_ai_config`, `ghi_chu`) to a Firestore collection of the same name, preserving snake_case field names, to minimize changes to router and frontend code.

#### Scenario: Router reads a phiếu
- **WHEN** a router calls the data-access function that previously queried Supabase's `phieu` table
- **THEN** it reads from the Firestore `phieu` collection and receives documents with the same field names as before (`so_phieu`, `ngay`, `doi_tac`, `tong_tien`, `cong_trinh_id`, `loai`, etc.)

### Requirement: Existing numeric/string IDs are preserved as Firestore document IDs
The system SHALL use each record's existing Postgres ID value (e.g. `phieu.id`, `cong_trinh.id`, `hang_hoa.ma_hang`) as the Firestore document ID during migration, so that all existing foreign key references (`chi_tiet_phieu.phieu_id`, `user_congtrinh.cong_trinh_id`, etc.) continue to resolve correctly without an ID mapping table.

#### Scenario: Migrated chi_tiet_phieu still references correct phiếu
- **WHEN** the migration script writes a `chi_tiet_phieu` document that referenced `phieu_id = 123` in Supabase
- **THEN** the Firestore `phieu` collection has a document with ID `"123"` and the migrated `chi_tiet_phieu` document's `phieu_id` field still resolves to it

### Requirement: Tồn kho is computed at runtime, not stored as a materialized view
The system SHALL compute tồn kho (inventory balance) at request time by reading `phieu` and `chi_tiet_phieu` from Firestore and summing nhập (`NK`) minus xuất (`XK`) quantities, grouped by `(ma_hang hoặc ten_hang, cong_trinh_id)`, replacing the Postgres `v_ton_kho` view with the same logic already implemented in `compute_ton_kho()`.

#### Scenario: User views tồn kho for a công trình
- **WHEN** an admin or thủ kho requests `/api/ton-kho` for a given công trình
- **THEN** the system computes the current balance from that công trình's `phieu` and `chi_tiet_phieu` documents in Firestore and returns the same response shape as before

#### Scenario: Tồn kho reflects a newly created phiếu immediately
- **WHEN** a new `phiếu nhập` or `phiếu xuất` is created
- **THEN** the next tồn kho query for that công trình reflects the new phiếu without requiring any separate recalculation step

### Requirement: Deleting a công trình cascades to its phiếu, chi_tiet_phieu, and hàng hóa
The system SHALL delete, in order, all `chi_tiet_phieu` documents belonging to the công trình's `phieu`, then the `phieu` documents themselves, then the `hang_hoa` documents, then the `cong_trinh` document itself, using batched writes that respect Firestore's per-batch operation limit.

#### Scenario: Admin deletes a công trình with existing data
- **WHEN** an admin deletes a công trình that has phiếu, chi_tiet_phieu, and hàng hóa records
- **THEN** all of that công trình's chi_tiet_phieu, phiếu, and hàng hóa documents are deleted along with the công trình document, and none remain orphaned

#### Scenario: Stats endpoint reports accurate pre-delete counts
- **WHEN** the frontend calls the stats endpoint before showing the delete confirmation modal
- **THEN** it returns the exact count of phiếu, hàng hóa, and chi_tiet_phieu that will be deleted, matching what is actually deleted afterward

### Requirement: Existing data is migrated from Supabase without loss
The system SHALL provide a one-time migration script that copies every row from each of the 9 Supabase tables into the corresponding Firestore collection, preserving IDs, and reports a record count for each source table and destination collection so the counts can be verified to match.

#### Scenario: Migration count verification
- **WHEN** the migration script finishes running
- **THEN** it prints the number of records read from each Supabase table and the number of documents written to each Firestore collection, for manual comparison before cutover

### Requirement: API route response shapes are unchanged
The system SHALL keep the JSON request/response shape of all existing `/api/*` routes unchanged after switching their internal data access from Supabase to Firestore.

#### Scenario: Existing frontend code keeps working
- **WHEN** the frontend calls any existing `/api/*` route after the migration
- **THEN** the response JSON has the same shape as before the migration, requiring no frontend changes to consume it
