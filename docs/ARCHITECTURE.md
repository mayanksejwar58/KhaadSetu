# Architecture

## Runtime

The app uses Next.js App Router, React, Tailwind CSS, and Payload 4 in the Figma-managed backend runtime. Payload owns persistence, admin authentication, and file infrastructure. The public pages are statically generated and hydrate a focused client component for interactions.

## Domain boundaries

1. **Candidate classification:** Model B may rank candidate product codes only. It is currently unavailable.
2. **Reviewed guidance:** `agronomic-guidelines` stores approved commercial rates and traceability. It is empty and private.
3. **Quota policy:** `quota-policies` stores approved entitlement rules. It is empty and private.
4. **Inventory:** `inventories` records physical and reserved bags. Public reads support the demo; writes remain admin-only.
5. **Reservation:** `fertilizer-requests` defines request states and idempotency keys. Mutations are not exposed without app authentication and transactional enforcement.
6. **Forecast:** `/api/forecast/run` is stateless and separate from recommendation and allocation.
7. **Simulation:** `/api/simulation/run` is pure compute and cannot modify live inventory.

## Soil report OCR

The farmer workspace processes PDF, PNG, JPG, and WEBP files in the browser. PDF.js first reads each page's embedded text. Pages with little or no selectable text are rendered to a canvas and passed to Tesseract.js. Raster images go directly to Tesseract. English and English + Hindi are supported. Reports are limited to 20 MB and 12 PDF pages per run. Text and per-page extraction method/confidence are displayed for manual review; OCR output never directly creates a recommendation or changes inventory. The OCR feature has no server upload endpoint.

## Windows development runtime

`run-khadsetu.ps1` validates the Node version, checks for the Figma-managed Payload environment in `.env.local`, installs dependencies, and starts the Next.js development server. The downloaded ZIP does not carry the platform-owned database credentials.

## Lifecycle

Public pages are fixed static routes. They do not perform build-time Payload reads. Live depot data is read after hydration from Payload REST, so content edits do not require page revalidation. Operational mutations must be added only with app authentication, ownership checks, and collection-boundary invariants.

## Missing production transaction layer

The current Payload schema expresses operational records, but there is no public request-creation or redemption endpoint. A production implementation must use a supported transaction/locking mechanism to atomically check available stock, create a full reservation or FIFO waitlist entry, and prevent duplicate redemption.
