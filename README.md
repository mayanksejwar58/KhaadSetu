# AI Synergy / KhadSetu — final hackathon MVP

This repository contains the standalone Render-ready Next.js application in `render-mvp/`, the original Figma/Payload source in the root `src/` tree, project architecture/model documentation, and a clean subset of the original FastAPI reservation/state-machine/routes/tests in `reference/original-fastapi/`.

The standalone Render target no longer depends on Figma OAuth/Payload credentials. It includes the end-to-end demo workflow from soil-report OCR through operator-reviewed fertilizer quantity, bag allotment, stock reservation, booking token, farmer confirmation and operator OTP redemption.

## What is implemented

- **Farmer/operator login:** server-verified demo IDs/PINs with signed HttpOnly session cookies and role-specific workspaces.
- **OCR:** PDF.js embedded-text extraction; Tesseract.js OCR for scanned PDF pages and PNG/JPG/WEBP images; English and English+Hindi mode; page labels, confidence and extraction progress; 20 MB and 12-page demo limits.
- **Farmer report phases:** upload → OCR → farmer verifies N/P/K/organic carbon/pH/EC → crop and acreage → submit to shared operator review queue.
- **Operator review:** see the submitted measurements and OCR source text; enter product, bag weight, crop/region/season guideline-derived application rate, source reference and explicit guideline acknowledgement.
- **Fertilizer quantity and bag suggestion:** convert acres to hectares, calculate total kg, show full bags + remainder and round up to full bags to allot. This is arithmetic from the operator-entered rate, not an ML dose prediction.
- **Allotment booking:** farmer chooses depot; full bag count reserves or waits in FIFO queue. The service rejects partial bags, wrong product, wrong bag size, changed quantity and duplicate live bookings.
- **Token lifecycle:** `KS-YYYY-000001` token for a booking; six-character OTP only when stock is reserved; farmer confirmation; assigned operator validates OTP at the correct depot; stock is decremented only on redemption.
- **Expiry/cancellation/waitlist:** 20-minute reservation expiry; released stock is re-offered in strict FIFO order; cancellation releases reservation; waitlisted requests do not lock stock.
- **Inventory:** physical, reserved and available bags, operator physical stock reconciliation, stock audit history.
- **Planning views:** demand forecast baseline, allocation simulation and Model B availability/status.

## Local run on Windows PowerShell

Requirements: Node.js `24.22.1.x` and npm. From the extracted repository root (the folder containing `run-render-mvp.ps1`):

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-render-mvp.ps1
```

The launcher changes into `render-mvp/`, installs dependencies when needed and starts the dev server at `http://localhost:3000`. The first OCR use needs internet access to fetch Tesseract worker/language data. Keep PowerShell open while using the site.

Direct alternative:

```powershell
cd .\render-mvp
npm install
npm run dev
```

## Demo accounts

| Role | Login ID | PIN | Assigned depot |
|---|---|---:|---|
| Farmer | `FMR-DEMO-1042` | `1042` | — |
| Farmer | `FMR-DEMO-1043` | `1043` | — |
| Operator | `OPS-KNL-01` | `2101` | Karnal (`HR-KNL-01`) |
| Operator | `OPS-GWL-01` | `2102` | Gwalior (`MP-GWL-01`) |
| Operator | `OPS-DL-01` | `2103` | North Delhi (`DL-NTH-01`) |

These public demo credentials are not real government accounts. Replace them with proper identity management before any public or production use.

## End-to-end test workflow

1. Sign in as `FMR-DEMO-1042` / `1042`.
2. Open Farmer; upload a digital/scanned PDF or image. Alternatively, manually enter sample readings if the OCR engine/language download is unavailable.
3. Check every extracted N/P/K, OC, pH and EC value against the original report. Enter crop and land area; tick the confirmation and submit.
4. Sign out; sign in as `OPS-KNL-01` / `2101`.
5. Select the report. Review the original extracted text and readings. Enter product, depot-matching retail bag weight (demo: UREA 45 kg; DAP/NPK/MOP 50 kg), rate from a verified crop/region/season guideline, source reference, and guideline acknowledgement. Approve the quantity.
6. Sign out and sign in as the farmer. The approved product, kg amount and whole bags to allot appear in report history. Select a depot and create booking.
7. If the entire bag count is available, the system reserves all bags and shows a `KS-2026-xxxxxx` token plus six-character OTP. If not, it issues a token with FIFO waitlist position and no OTP.
8. Farmer clicks **Confirm token** while the 20-minute reservation is active.
9. Sign out and sign in as the operator assigned to that depot. Select the CONFIRMED token, enter the farmer OTP and redeem.
10. Check that status becomes CLAIMED, physical stock falls by the booking quantity and reserved stock falls by the same quantity.
11. To test waitlisting, create a booking larger than available stock, then reconcile the operator depot physical count to a sufficient number. FIFO head-of-line request is promoted and receives an OTP.

## Example bag arithmetic (not agronomic advice)

For a test input of 2.4 acres, an operator-entered rate of 100 kg product/ha, and a 45 kg retail bag:

- Area: 0.9712 ha
- Product quantity: 97.12 kg
- Full bags: 2, remainder: 7.12 kg
- **Suggested allotment: 3 full bags** (135 kg retail quantity)

The app does not decide whether 100 kg/ha is correct. The operator must obtain and check an appropriate agronomist/government/university guideline for crop, region, season and soil conditions.

## Render deployment

- `render.yaml` at repository root: fastest free demo. Free filesystem is ephemeral; reports, bookings, tokens and stock changes may be lost on restart/redeploy/sleep.
- `render.persistent.yaml` at repository root: paid Starter single-instance web service with a 1 GB disk mounted at `/var/data`; the Blueprint sets `KHADSETU_DATA_FILE=/var/data/khadsetu.json`.

In Render, select **New → Blueprint**, connect the GitHub repository and choose the desired Blueprint file. The service root is `render-mvp`; the build command is `npm install --no-audit --no-fund && npm run build`; start command is `npm start`; health check is `/api/health`. The Blueprint generates `KHADSETU_SESSION_SECRET`; no Figma OAuth credential is needed.

The JSON store is serialized and atomically written but intentionally single-instance. For real multi-instance/production use, migrate it to managed PostgreSQL with transactional stock locking, backups, monitoring, authentication, authorization and rate limits. Render persistent disks are not a substitute for a transactional database at scale.

## Model and data truth

- OCR is extraction, not soil validation or fertilizer recommendation.
- The supplied Model B is documented as untrained/unavailable. The standalone MVP does not claim to predict fertilizer product or dose.
- Product rate and product selection are operator-entered and require a source reference and acknowledgement. Quantity and bags are arithmetic only.
- Demo depot, inventory, user accounts and forecast data are synthetic. This must not be used for actual government stock, procurement, subsidy eligibility, dispensing or agronomic advice.
- Never enter Aadhaar numbers, real identity documents, sensitive farmer details or production government records into this demo.

## Tests and references

Run the isolated workflow suite from `render-mvp/`:

```powershell
npm run test:workflow
```

The suite covers sign-in/session signatures, OCR label parsing, quantity-to-bag rounding, booking lifecycle, idempotency, FIFO waitlisting/promotion, reservation expiry, OTP/depot enforcement, and stock reconciliation. See:

- `TEST_REPORT.md`
- `SECURITY_AUDIT.md`
- `docs/CHAT_HISTORY_TRACEABILITY.md`
- `render-mvp/docs/FINAL_HANDOFF.md`
- `render-mvp/docs/API_REFERENCE.md`
- `render-mvp/docs/ALLOTMENT_TOKENS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_DICTIONARY.md`
- `docs/MODEL_CARD_MODEL_B.md`
- `docs/MODEL_CARD_DEMAND_FORECAST.md`
- `reference/original-fastapi/README.md`

Original FastAPI code paths used as behavioural references are listed in `docs/CHAT_HISTORY_TRACEABILITY.md` (reservation, state machine, request/token routes, inventory and tests). The separate uploaded original source archive remains the reference source; do not deploy its older Figma/Payload target in place of the self-contained `render-mvp/` app.
