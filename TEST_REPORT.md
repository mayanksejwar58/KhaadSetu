# KhadSetu final MVP verification report

Date: 2026-10-30

## Current standalone Render MVP (`render-mvp/`)

### Passed

- Isolated automated suite: **16/16 tests passed** using `node --experimental-strip-types --test tests/*.test.mjs` (also exposed as `npm run test:workflow`).
- Demo authentication: farmer and all three depot operator IDs map to correct roles/centres; invalid PIN rejected; signed HttpOnly cookie resolves identity; tampered cookie rejected.
- OCR parser: recognized N/P/K/OC/pH/EC labels; absent values remain empty; comma decimal separators normalized without unit conversion.
- Quantity calculation: 2.4 acres × 100 kg product/ha = 97.12 kg; with 45 kg retail bags = 2 full bags + 7.12 kg remainder and 3 whole bags to allot; exact-bag and invalid-input cases tested.
- Booking lifecycle: full reservation, token/OTP issuance, farmer confirmation, operator redemption, physical/reserved stock decrement, duplicate replay idempotency, FIFO waitlist, expiry and FIFO promotion, depot/OTP checks, reconciliation safety and audit history.
- TypeScript/TSX syntax transpile parse: **32 source files, zero syntax diagnostics**.
- Render Blueprint files and PowerShell launcher inspected; root has free preview `render.yaml` and paid persistent-disk `render.persistent.yaml`.
- ZIP integrity check performed for final package after packaging.

### Not verified / not to be claimed as passed

- A full dependency-backed `npm install`, `npm run build`, `npm start` and browser E2E run were not completed in this environment. Earlier dependency installation failed because registry DNS access returned `EAI_AGAIN registry.npmjs.org`. Syntax transpilation is not the same as a Next.js production build.
- A live Render service was not deployed from this environment. The user must complete the Blueprint deployment and verify `/api/health` on the generated URL.
- Browser OCR against representative real Hindi/English soil reports, image rotations, blur, faint scans, handwritten forms, and OCR accuracy benchmarks was not evaluated. The OCR path is implemented, but OCR correctness is not certified.
- No agronomist validated product/rate guidance; the supplied Model B is untrained/unavailable. Quantity calculations use an operator-entered rate and are not ML dose predictions or agronomic advice.
- Inventory/accounts/forecast fixtures are synthetic. JSON store is single-instance. Real multi-user production requires PostgreSQL transaction/row-lock semantics, auth, security and operational checks.

## Commands to repeat on Windows

From the extracted project root:

```powershell
node -v
Set-ExecutionPolicy -Scope Process Bypass
.\run-render-mvp.ps1
```

Then in another PowerShell window, from the root:

```powershell
cd .\render-mvp
npm run test:workflow
npm run build
npm start
```

Expected Node: `v24.22.1` (24.x line). The web UI should be at `http://localhost:3000`; health at `http://localhost:3000/api/health`.

## Historical verification of the original Figma-managed source

The supplied original Figma/Payload source previously passed its platform managed verifier, route/API smoke tests and Payload content verification as recorded in earlier project notes. Those results apply to that Figma-managed runtime only. They do **not** verify the standalone Render build or the new standalone server-side booking/token workflow.

## Booking regression coverage

1. Complete booking reserves whole bag count, issues token/OTP, confirms and redeems once.
2. Idempotent replay returns same token without double-reserving.
3. Insufficient stock creates FIFO waitlist; releasing stock promotes the head request.
4. Wrong OTP, wrong depot/operator and bag quantity mismatch rejected.
5. Expiry frees reserved stock and promotes FIFO queue.
6. Reconciliation cannot undercut reserved stock and writes audit.

## Quantity/parser/auth regression coverage

7. Farmer demo credential authentication and wrong PIN rejection.
8. Three operators map to correct depot IDs.
9. Signed session cookie authenticates; tampered signature rejected.
10. Acres-to-hectares and full-bag rounding, including exact bag multiple and bounds.
11. OCR parser extracts labelled soil readings, does not invent missing values and normalizes decimal comma.

Total: 16 tests.
