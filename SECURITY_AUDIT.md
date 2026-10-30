# Security and deployment audit — KhadSetu standalone Render MVP

## Implemented in the standalone `render-mvp/` target

- Server-side demo-account lookup; credentials are not returned from the login API.
- Signed HMAC session cookie with `HttpOnly`, `SameSite=Lax`, an 8-hour expiry and `Secure` in production. Render Blueprint generates `KHADSETU_SESSION_SECRET`; production refuses to start authentication without it.
- Role checks on farmer/operator APIs, operator-centre enforcement for stock reconciliation and token redemption, farmer ownership checks for confirmation/cancellation, and operator-only recommendation approval.
- Farmer report input bounds and OCR/extracted-text size bounds; OCR is browser-local and source text must be reviewed by a person.
- JSON store write serialization and atomic file replacement for a single running process.
- Booking invariants: full bag quantity only, one active booking per soil report, idempotency key, product and bag-weight match, reserve/available stock accounting, expiry, FIFO waitlist, farmer confirmation, correct depot and OTP redemption, audit events.
- No Aadhaar, real payment, or actual entitlement handling is implemented.

## Explicit risks and non-production limits

- Demo IDs/PINs are public static test credentials. Signed sessions are only for the demo. Replace with a managed identity provider and individual accounts before public access.
- The JSON file store is single-instance and does not provide cross-process/multi-instance transactional locking. Use managed PostgreSQL and database transactions/row locks for production or multiple Render instances.
- Render free filesystem is ephemeral. Use the paid persistent Blueprint for demo state retention; this does not remove the single-instance limitation.
- The 6-character OTP is a demo collection code, not SMS/email OTP or government-issued entitlement. Add delivery, attempt throttling, lockout, replay monitoring and operator audit requirements for production.
- No authentication rate limiter, MFA, password reset, user provisioning, admin lifecycle, backup/restore automation or operational monitoring is included.
- The browser performs OCR. OCR output is untrusted and potentially inaccurate; it requires farmer and operator verification.
- Model B is untrained/unavailable. No AI dose/product recommendation is made. Operator-entered rate + source reference is only acknowledged, not externally validated by the service.
- Depot, inventory, identities and forecast data are synthetic. Not suitable for official allocation, procurement, subsidy claims, dispensing or real farmer use.
- The browser report store is server-side JSON for this hosted demo, but uploaded source files are not stored server-side. Extracted text is stored for workflow review; do not upload sensitive identity material.
- Full dependency-backed `next build`, package vulnerability audit, browser automation, penetration test, multi-user concurrency/load test and live Render deployment have not been verified in this environment.

## Required before real pilot/production

1. Replace static demo identities with managed authentication, secure provisioning, MFA for operators, least-privilege roles and rate limiting.
2. Move JSON state into managed PostgreSQL; make booking/reserve/redeem/waitlist transitions transactional with row locks and unique constraints.
3. Use official verified depot stock feeds and traceable inventory transactions; reconcile physical counts with dual control.
4. Use approved agronomic guideline records with jurisdiction, crop, season, soil test method, units, source date, expiry and domain-expert approval.
5. Train and validate recommendation models on lawful, representative, traceable data. Independently review agronomic safety and explainability.
6. Establish OCR accuracy tests across scans, scripts, rotations, quality bands and soil-report formats; retain a human correction workflow.
7. Add monitoring, alerting, encrypted backups, retention controls, privacy notices, incident response, audit export and legal review.
