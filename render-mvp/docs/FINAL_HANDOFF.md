# KhadSetu final project handoff

## Product intent from the project/chat requirements

KhadSetu is the AI Synergy fertilizer planning and allotment prototype for a hackathon demo. It should connect the farmer's soil-health document to human-verified soil readings, a fertilizer product/quantity plan, depot stock, booking/token issuance and operator fulfilment. The operator dashboard owns stock and token redemption. A forecast/constraint view supports depot planning. It is a web MVP deployed on Render, with local Windows PowerShell startup.

## Implemented in this deliverable

- **Farmer/operator login:** server checks the demo IDs/PINs and issues a signed HttpOnly, SameSite=Lax session cookie. Demo IDs are printed in `README.md`.
- **Farmer soil report:** PDF/image selection, PDF.js direct text extraction, Tesseract.js OCR for scanned PDFs and images, English and English+Hindi modes, extraction progress, confidence display and source text.
- **Reading phase:** farmer reviews N/P/K, organic carbon, pH and EC, crop and acreage. OCR values remain editable and require explicit farmer confirmation.
- **Shared report queue:** reports are stored in server-side JSON, not only localStorage, so the farmer and operator can sign in separately while connected to the same running service.
- **Operator recommendation:** operator enters product, approved product rate, exact bag weight and a source reference, and checks the agronomy acknowledgement. Server stores the approved plan.
- **Bag suggestion:** quantity is calculated from acreage × 0.4046856422 × operator-entered product rate. It reports full bags + remainder and rounds up to `bagsToBook` complete retail bags. Booking is disallowed unless the depot pack size matches the recommendation.
- **Allotment booking:** farmer chooses depot and asks for the full bag count. Server reserves all bags if available or creates a FIFO waitlist. A booking token is always created; OTP is only issued for reserved stock.
- **Farmer token wallet:** reserved token confirmation, active OTP, waitlist position, cancellation, expiry and collection status.
- **Operator token counter:** list of depot bookings; operator chooses confirmed token and enters OTP for redemption.
- **Stock accounting:** initial, reserved and available quantities display separately. Redemption reduces physical and reserved stock together. Operator can reconcile physical count; eligible FIFO waitlist items can be promoted.
- **Audit history:** booking state transitions are stored on each booking; physical stock reconciliations are stored in inventory audit entries in JSON.
- **Planning pages:** demand forecast baseline, constraint simulation and Model B status.
- **Deployment:** free preview Blueprint (`render.yaml`) and paid disk-backed single-instance Blueprint (`render.persistent.yaml`), plus PowerShell local launcher.

## Demo accounts

| Role | Login ID | PIN | Depot |
|---|---|---:|---|
| Farmer | `FMR-DEMO-1042` | `1042` | — |
| Farmer | `FMR-DEMO-1043` | `1043` | — |
| Operator | `OPS-KNL-01` | `2101` | Karnal |
| Operator | `OPS-GWL-01` | `2102` | Gwalior |
| Operator | `OPS-DL-01` | `2103` | North Delhi |

## Demo data

Three demo depots: Karnal (HR-KNL-01), Gwalior (MP-GWL-01), and North Delhi (DL-NTH-01). Product lines are UREA, DAP, NPK and MOP. UREA sample retail pack size is 45 kg; DAP/NPK/MOP sample retail pack size is 50 kg. Inventory counts are intentionally synthetic for demonstrations and allocation testing.

## Model/data status: do not overclaim

- OCR is a document extraction component, not a soil classifier or fertilizer recommender.
- The supplied project documentation marks Model B as not trained / no trusted artifact available. Do not relabel a human-entered operator rate as an ML recommendation.
- The delivered demo uses an operator-selected product/rate plus a source reference and calculates kilograms/bags arithmetically. This is not agronomic advice.
- Demand forecast and depot inventory are synthetic demonstration data. They must not be used for procurement, government distribution or real farmer entitlements.
- Before model activation: obtain traceable, legally usable, crop/region/season-specific soil-health and application outcome data; normalize units and fertilizer labels; separate training/evaluation by field/farmer/region; evaluate bias/error; have agronomists validate the output; version the model and document supported conditions.

## Storage and hosting limits

The service store is a local JSON file guarded by an in-process serialized write queue and atomic replacement. It supports a single running instance. Local Windows data is written under `render-mvp/data/khadsetu-demo-store.json` unless `KHADSETU_DATA_FILE` is set.

- Render free Blueprint (`render.yaml`): easy judging deployment, but its filesystem is ephemeral and demo records can be lost on sleep/restart/redeploy.
- Render paid persistent Blueprint (`render.persistent.yaml`): attaches `/var/data` and preserves the JSON store. Disk is single-instance only.
- Real production: replace JSON storage with PostgreSQL transaction/row-lock logic, enable backup and monitoring, rate-limit authentication, use real identity provider/role permissions, protect PII, and perform load/concurrency tests.

## Windows local run

At repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-render-mvp.ps1
```

Node.js 24.22.1.x is required. Open `http://localhost:3000`. Keep the PowerShell process open.

## Suggested end-to-end smoke test

1. Sign in as `FMR-DEMO-1042` / `1042`.
2. Upload a PDF/image or enter readings manually; use a sample with labelled N/P/K values.
3. Confirm readings, set crop and area, submit.
4. Sign out. Sign in as `OPS-KNL-01` / `2101`.
5. Open farmer report queue, select the submitted report, choose product and correct depot pack size (UREA 45 kg; others 50 kg), enter an externally verified source reference, tick the guideline acknowledgement and approve.
6. Sign out. Sign in as the farmer. Select the approved report, choose Karnal and create booking.
7. Verify that a `KS-2026-xxxxxx` token appears, stock reserved increases, and a six-character OTP appears for RESERVED status.
8. Click **Confirm token** as farmer. The token becomes CONFIRMED.
9. Sign out. Sign in as `OPS-KNL-01`. Choose the confirmed token, enter the farmer OTP and redeem.
10. Verify CLAIMED status, physical stock reduced by the token's bag count, reserved stock reduced by the same amount, and farmer sees collection success.
11. To test FIFO: lower/reconcile physical stock below demand, create a second booking to waitlist, then increase physical count through operator reconciliation. The next fully satisfiable waitlist request is promoted and receives an OTP.

## Verification status (2026-10-30)

- `npm run test:workflow`: 16 tests passed (auth/session, OCR label parser, quantity/bag rounding and booking/token lifecycle).
- TypeScript/TSX syntax transpile: 32 source files, zero syntax errors.
- Full `npm install`, Next.js production build, browser run and live Render deploy were not verified here because the package registry was unreachable in the build environment. Do not mark a live deployment as complete until Render reports a successful deploy and `/api/health` responds.

## Source references carried forward

A clean subset of the original FastAPI reservation/state-machine/routes/tests is included under `reference/original-fastapi/`. The full source archive was supplied separately as `ai-synergy-5(3).zip`; it is not duplicated here because it also contains virtual environments, local database files and generated dependencies. Top-level `docs/` architecture and model references remain in this repository. See `docs/CHAT_HISTORY_TRACEABILITY.md` for the requirement-to-code matrix and exact source paths. The original service paths and the matching standalone API contract are listed in `docs/API_REFERENCE.md` and `docs/ALLOTMENT_TOKENS.md`.
