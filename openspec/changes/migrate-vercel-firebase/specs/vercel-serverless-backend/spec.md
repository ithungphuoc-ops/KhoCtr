## ADDED Requirements

### Requirement: Backend runs as Vercel Serverless Functions on the production domain
The system SHALL serve all `/api/*` backend routes from Vercel Serverless Functions (Python runtime) reachable from the `khoct.hpcore.vn` domain, replacing the current Render.com deployment, once the PDF-rendering feasibility spike (see below) confirms the architecture is viable.

#### Scenario: Frontend calls the API on the production domain
- **WHEN** the frontend running on `khoct.hpcore.vn` calls any `/api/*` route
- **THEN** the request is handled by a Vercel Serverless Function running the same FastAPI application logic as before

### Requirement: PDF-rendering AI flow feasibility is verified before committing to full Vercel migration
The system SHALL NOT commit to running the `pymupdf`/`fitz`-based PDF-to-image rendering flow (used by AI phiếu reading) on Vercel Serverless Functions until a spike deployment confirms acceptable package size, cold-start time, and execution time within the target Vercel plan's limits.

#### Scenario: Spike passes
- **WHEN** the spike deployment successfully renders a real sample phiếu PDF within the timeout of the target Vercel plan, with a deployable package size
- **THEN** the AI reading endpoints (`/api/ai/*`) are migrated to Vercel along with the rest of the backend

#### Scenario: Spike fails
- **WHEN** the spike deployment exceeds Vercel's package size limit, or execution consistently exceeds the target plan's timeout
- **THEN** the AI reading endpoints (`/api/ai/*`) remain on Render.com while the rest of the backend migrates to Vercel, and this hybrid architecture is documented and confirmed with Sếp before implementation continues

### Requirement: Frontend and backend deploy as a single Vercel project
The system SHALL deploy the frontend (static Vite build) and backend (Python Vercel Functions under `/api`) together as one Vercel project on the `khoct.hpcore.vn` domain, matching the single-deployment pattern used by every other company app (hpcons-portal, ITAsset, pkd-crm), rather than as two separately hosted origins requiring a proxy or rewrite bridge between them.

#### Scenario: Frontend calls its own backend same-origin
- **WHEN** the frontend calls a relative `/api/*` path
- **THEN** the request is handled by the same Vercel project's Python Function, with no cross-origin hop or rewrite configuration required

### Requirement: Hosting migration and database migration are independently staged and rollback-able
The system SHALL move the backend's hosting from Render to Vercel (Stage 1) while it still reads/writes Supabase unchanged, as a lower-risk step that can be verified and rolled back (by re-pointing the domain to Render) without touching data. The database migration from Supabase to Firestore (Stage 2) SHALL happen afterward, independently, within the same already-migrated Vercel project.

#### Scenario: Stage 1 deployed alone
- **WHEN** only the hosting migration (Stage 1) is complete
- **THEN** the application on `khoct.hpcore.vn` reads and writes the same Supabase database as before, and all existing functionality continues to work exactly as before, with no data migration having occurred

#### Scenario: Stage 1 rollback
- **WHEN** Stage 1 needs to be rolled back
- **THEN** re-pointing the `khoct.hpcore.vn` domain (or DNS) back to the Render deployment restores prior behavior, since Supabase was never touched during Stage 1

### Requirement: Environment secrets are configured on Vercel without exposure
The system SHALL configure all required secrets (Firebase service account credentials, `JWT_SECRET`, `SETUP_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`) as Vercel encrypted environment variables, never committed to the repository or displayed unmasked in logs or chat.

#### Scenario: Backend reads secrets at runtime
- **WHEN** a Vercel Function needs to authenticate to Firebase or call an AI provider
- **THEN** it reads the credential from a Vercel environment variable, and no part of the codebase or deployment logs prints the full secret value
