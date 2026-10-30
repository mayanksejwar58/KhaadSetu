# KhadSetu chat-history requirements and implementation traceability

This document consolidates the project requirements stated across the KhadSetu planning, OCR, login, farmer/operator, fertilizer recommendation, booking/token, deployment and PowerShell conversations. It is a project handoff and traceability record, not an assertion that every production integration is complete.

## Product objective

Build a web MVP for farmer soil-report intake and reviewed fertilizer allotment. The farmer provides soil-report evidence and verifies OCR readings. An operator reviews those readings and an approved crop/region/season application guideline. The system calculates a product quantity and full retail-bag count, checks depot inventory, creates a booking/token, and lets the assigned operator redeem it with the farmer's OTP. Forecasting and allocation simulation support planning but must not override stock-backed booking invariants.

## Requirement-to-code matrix

| Conversation requirement | Current implementation | Main code / proof | Status and limit |
|---|---|---|---|
| Standalone website runnable outside Figma Make | Independent Next.js app under `render-mvp/`; root PowerShell launcher | `render-mvp/package.json`, `run-render-mvp.ps1`, `render.yaml` | Implemented as demo; full dependency-backed local build not verified in this environment |
| Farmer and operator login with IDs | Server-side fixed demo accounts, HMAC signed HttpOnly session cookie, role-specific screen/API restrictions | `render-mvp/src/lib/server-auth.ts`, `render-mvp/src/app/(frontend)/api/auth/*`, `KhadSetuApp.tsx` | Demo authentication only; use a real identity provider for deployment beyond a hackathon |
| Farmer soil-report upload and OCR | PDF.js for embedded PDF text; Tesseract for scanned PDF pages and image files; English and English+Hindi | `render-mvp/src/lib/soil-report-ocr.ts` | Browser OCR; max 20 MB and 12 PDF pages. Real OCR accuracy across report formats is not certified |
| OCR readings must be reviewed | Parser only extracts values adjacent to recognized labels; farmer confirms and edits N/P/K/OC/pH/EC before submission | `render-mvp/src/lib/farmer-workflow.ts`, `Farmer` in `KhadSetuApp.tsx` | Implemented. No automatic unit conversion or missing-value inference |
| Document review becomes operator's next phase | Farmer report is stored in server JSON and appears in operator report queue with extracted source text and readings | `/api/soil-reports`, `demo-store.ts`, `KhadSetuApp.tsx` | Implemented for one server instance |
| Fertilizer product and quantity recommendation | Operator enters product and source-backed product rate, source reference and acknowledgement; server calculates kg and bags | `/api/recommendations/calculate`, `fertilizer-quantity.ts` | Human/operator-reviewed rate; not an ML prediction. Service does not verify source correctness |
| Bag suggestion | Rounds total kg up to whole retail packs (`ceil(totalKg / bagWeightKg)`) | `fertilizer-quantity.ts`, report recommendation display | Implemented. Demo pack sizes: UREA 45 kg; DAP/NPK/MOP 50 kg |
| Allotment booking | Farmer requests the approved whole bag quantity at a depot; reserve all or waitlist all | `/api/bookings`, `demo-store.ts:createBooking` | Implemented for single process; no partial reservation |
| Token generation | `KS-YYYY-000001` code for reserved or waitlisted booking; OTP only when stock is reserved | `demo-store.ts:makeTokenCode`, `makeOtp`, `createBooking` | Implemented demo token, not an official government token or SMS OTP |
| Farmer token confirmation | Farmer confirms RESERVED booking before operator redemption | `/api/bookings/[bookingId]/confirm` | Implemented |
| Operator token redemption | Operator must be assigned to the booking depot, submit the matching OTP and redeem CONFIRMED booking | `/api/bookings/[bookingId]/redeem`, `demo-store.ts:redeemBooking` | Implemented; physical stock is decreased only on successful redemption |
| Stock and waitlist | Physical, reserved and available bags; FIFO whole-request waitlist; expiration/cancel release; reconciliation promotes eligible queue | `demo-store.ts`, `/api/inventories`, `/api/inventory/[centreId]/reconcile` | Implemented; synthetic inventory and single-instance JSON store |
| Notifications / token visibility | Farmer token wallet and operator token counter update by five-second polling | `KhadSetuApp.tsx` | In-app status only; no SMS, WhatsApp, email or push notification provider connected |
| Demand forecast and allocation console | Existing baseline forecast and deterministic simulation remain available to operator | `/api/forecast/run`, `/api/simulation/run` | Demo planning data; not linked to booking mutation |
| Model B fertilizer prediction | Honest status page retained | `/api/synergy/model-b/status`, `docs/MODEL_CARD_MODEL_B.md` | Not trained / unavailable in supplied evidence. No fake prediction is produced |
| Dataset adaptation | Model/dataset provenance and limitations documented; synthetic demo data kept separate | `docs/MODEL_CARD_*`, `README.md`, `FINAL_HANDOFF.md` | Real, validated soil/crop/region/season/outcome dataset still required |
| Render hosted demo | Free Blueprint and paid persistent-disk Blueprint | root `render.yaml`, root `render.persistent.yaml` | Configured; live Render deployment not completed/verified from this environment |
| Local Windows run | PowerShell launcher checks Node 24.22.1.x, installs dependencies, starts Next dev server | `run-render-mvp.ps1` | Launcher supplied. User's Windows Node was updated to v24.22.1 in chat; run from extracted project root |
| Full original implementation references | Original FastAPI booking service/state-machine/routes/tests are mapped below | Original uploaded archive `ai-synergy-5(3).zip` | Reference source, not the deployed Next.js runtime |

## Demo account reference

| Role | ID | PIN | Name / centre |
|---|---|---:|---|
| Farmer | `FMR-DEMO-1042` | `1042` | Meera Devi |
| Farmer | `FMR-DEMO-1043` | `1043` | Rajesh Kumar |
| Operator | `OPS-KNL-01` | `2101` | Anita Sharma · Karnal (`HR-KNL-01`) |
| Operator | `OPS-GWL-01` | `2102` | Rakesh Singh · Gwalior (`MP-GWL-01`) |
| Operator | `OPS-DL-01` | `2103` | Neha Verma · North Delhi (`DL-NTH-01`) |

Public test credentials only. Do not use as real identity access.

## Original FastAPI reference implementation

The supplied full source archive `ai-synergy-5(3).zip` contains the earlier FastAPI/SQLAlchemy implementation. A clean reference subset of the exact reservation-related source and tests is now included in this final project under `reference/original-fastapi/`. The original archive path from which the subset was extracted is:

```text
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/app/services/reservation.py
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/app/services/state_machine.py
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/app/routes/requests.py
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/app/routes/tokens.py
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/app/routes/inventory.py
ai-synergy-5/ai-synergy-4/ai-synergy-2/khadsetu/backend/tests/test_reservation.py
```

The included reference folder retains `reservation.py`, `state_machine.py`, the request/token/inventory routes, database/models and original reservation/database tests. It defines full-quantity reservations, FIFO waitlisting, token lifecycle, idempotency, reservation expiry, OTP redemption and inventory accounting. The standalone demo mirrors the workflow but stores state in a single-instance JSON file rather than the original backend's SQL database. The complete uploaded archive is not duplicated into this ZIP because it contains virtual environments, local DB files and generated dependencies.

## Conversation-history sequence consolidated

1. The hackathon product is KhadSetu, a fertilizer allocation and farmer support prototype.
2. Farmer and operator are distinct roles and require separate ID-based access.
3. A farmer uploads a PDF soil-health/lab report; OCR reads it and sends extracted readings to the next workflow phase.
4. OCR data must be checked before recommendations. The farmer verifies readings and the operator reviews them.
5. A fertilizer product and application rate must be selected against a valid agronomic source; the system should show total product quantity and suggested number of retail bags.
6. The allotment/booking stage must not disappear: the farmer books the recommended whole bag quantity at a depot, obtains a token and tracks its status.
7. Stock is reserved before the collection appointment; a farmer confirms the token; the operator checks OTP and assigned depot before collection; inventory changes only on redemption.
8. Shortage must create a waitlist, not a false reservation. Cancellations and expiry release stock; FIFO requests are promoted when enough stock is available.
9. Operator has inventory reconciliation and audit visibility. Forecast and simulation support planning but do not bypass the booking service.
10. The website must run locally from PowerShell and be deployable on Render, with exact limitations documented.
11. Product/rate prediction cannot be represented as ML while Model B is untrained and the validated training data is absent.

## Outstanding production work

- Replace demo credentials with managed identity and MFA/operator provisioning.
- Replace JSON file store with PostgreSQL transactional tables, constraints and row locks; add multi-instance concurrency tests.
- Connect official/verified inventory and agronomic guideline source records.
- Supply a legally usable, representative soil-health/fertilizer outcome dataset and train/evaluate Model B with agronomist review.
- Add SMS/WhatsApp/email token notifications, OTP throttling, audit export and monitoring.
- Run full `npm install`, `npm run build`, `npm start`, browser OCR tests and live Render deployment; no such live deployment is claimed in this handoff.
