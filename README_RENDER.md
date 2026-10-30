# KhadSetu Render deployment guide

The standalone web app lives in `render-mvp/`. Keep the repository root files `render.yaml` / `render.persistent.yaml` and the whole `render-mvp/` directory when pushing to GitHub.

## Deploy

1. Push the complete project folder to GitHub.
2. Open Render Dashboard → **New → Blueprint**.
3. Connect the repository and choose root `render.yaml` for a temporary free demo or root `render.persistent.yaml` for a paid disk-backed demo.
4. Render builds from `render-mvp/` with `npm install --no-audit --no-fund && npm run build` and starts `npm start`.
5. The Blueprint generates `KHADSETU_SESSION_SECRET` automatically. No Figma Make OAuth or Payload credentials are required.
6. Open the generated `onrender.com` URL and check `/api/health`, `/`, `/farmer` and `/operator`.

## Storage choice matters

The app stores reports, booking tokens, stock reservations and audit events in one server-side JSON file. The write path is serialized and atomically replaces the file, but it is a **single-instance demo store**, not a multi-instance database.

- Free `render.yaml`: easiest judging link, but free service filesystem is ephemeral and demo state can be lost on restart/redeploy/sleep.
- Paid `render.persistent.yaml`: Starter single instance, 1 GB disk at `/var/data`; configures `KHADSETU_DATA_FILE=/var/data/khadsetu.json` to preserve demo workflow data.
- Production/multi-instance: migrate to managed PostgreSQL and transactional row locking before real stock allotment.

## Local PowerShell

From the extracted project root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-render-mvp.ps1
```

Node.js `24.22.1.x` is required. Open `http://localhost:3000`. Keep the PowerShell session running. First OCR run needs internet for Tesseract language data.

## Demo credentials

- Farmer: `FMR-DEMO-1042` / `1042`
- Farmer: `FMR-DEMO-1043` / `1043`
- Karnal operator: `OPS-KNL-01` / `2101`
- Gwalior operator: `OPS-GWL-01` / `2102`
- North Delhi operator: `OPS-DL-01` / `2103`

## Complete demo loop

Farmer OCR report → farmer checks readings → operator reviews source and enters approved rate/product → system calculates quantity and whole retail bags → farmer books full bag allotment → token/OTP reservation → farmer confirms → assigned operator redeems OTP → physical/reserved stock updates → farmer sees CLAIMED status. No partial reservation is made; insufficient stock creates a FIFO waitlist token.

See `render-mvp/docs/FINAL_HANDOFF.md`, `render-mvp/docs/API_REFERENCE.md` and `render-mvp/docs/ALLOTMENT_TOKENS.md` for workflow, API details and state invariants.

## Limitations

Model B is untrained and is not used to predict product/dose. Product/rate is operator-entered with source acknowledgement. All inventory is synthetic. Demo IDs/PINs are public. The JSON store is single-instance. Do not use for official government allocation, actual fertilizer prescriptions, real identity documents or real stock.
