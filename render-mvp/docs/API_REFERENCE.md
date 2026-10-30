# KhadSetu MVP API reference

All authenticated mutations/read endpoints use the signed `khadsetu_demo_session` HttpOnly cookie issued by `/api/auth/login`. Requests are same-origin. The API currently serves demo data.

## Authentication

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Verify demo ID/PIN; issue signed 8-hour cookie |
| GET | `/api/auth/session` | Public | Return current demo identity or `null` |
| POST | `/api/auth/logout` | Signed-in | Clear session cookie |

## Soil reports and recommendations

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/soil-reports` | Farmer | Save verified OCR/manual soil readings into shared report queue |
| GET | `/api/soil-reports` | Farmer / operator | Farmer sees own reports; operator sees review queue |
| POST | `/api/recommendations/calculate` | Operator | Validate source acknowledgement, calculate kg/bags, and persist approved recommendation |

Recommendation body fields: `reportId`, `areaAcres`, `rateKgPerHa`, `bagWeightKg`, `product` (`UREA`, `DAP`, `NPK`, `MOP`), `sourceReference`, `guidelineChecked`.

The output includes `totalQuantityKg`, `wholeBags`, `remainingKg`, `bagsToBook` and source/disclaimer. `bagsToBook = ceil(totalQuantityKg / bagWeightKg)`. A rate is not inferred by this endpoint; it must be checked against the cited guideline/agronomist instruction by the operator.

## Allotment and tokens

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/bookings` | Farmer | Reserve full bag count or create FIFO waitlist token |
| GET | `/api/bookings` | Farmer / operator | Farmer sees own wallet; operator sees tokens for assigned depot |
| POST | `/api/bookings/:id/confirm` | Farmer | Confirm a reserved token before collection |
| POST | `/api/bookings/:id/cancel` | Farmer | Cancel RESERVED, CONFIRMED or WAITLISTED booking |
| POST | `/api/bookings/:id/redeem` | Assigned operator | Verify OTP and mark bags collected |

Booking body fields: `reportId`, `centreId`, `productCode`, `quantityBags`, `idempotencyKey`. The server rejects booking unless the report has an operator-approved recommendation and the selected product, bag weight and full bag count match that recommendation and the depot pack.

Token lifecycle:

```text
RESERVED -> CONFIRMED -> CLAIMED
    |           |
    +-----> EXPIRED
    +-----> CANCELLED
WAITLISTED -> RESERVED (FIFO promotion after eligible stock is released/reconciled)
WAITLISTED -> CANCELLED
```

- Token code format: `KS-YYYY-000001`.
- OTP: six characters from an ambiguity-reduced alphabet; generated only when a stock reservation exists.
- Reservation TTL: 20 minutes. Unconfirmed/expired reservations release reserved bags.
- Booking is whole-quantity only: insufficient stock produces `WAITLISTED`, never a partial token.
- Confirmation does not decrement physical stock. Redemption requires `CONFIRMED` plus the matching OTP and the operator's assigned centre. Physical stock and reserved stock are both reduced at redemption.
- Idempotency keys prevent a retry from creating a second reservation for the same payload.

## Depot inventory

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/centres` | Public demo read | List sample depots |
| GET | `/api/inventories` | Public demo read | Physical/reserved/available bags by depot/product |
| POST | `/api/inventory/:centreId/reconcile` | Assigned operator | Record physical stock count and promote eligible FIFO waitlist entries |
| GET | `/api/health` | Public | Service health/config mode |

Reconciliation rejects physical counts below existing reservations. It records operator, previous/new physical quantity, reserved quantity and note in the store's stock audit section.

## Existing analytical endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/forecast/run` | Synthetic transparent demand forecast baseline |
| POST | `/api/simulation/run` | Non-mutating overbooking / reservation simulation |
| GET | `/api/synergy/model-b/status` | Model B availability status |

The forecast and simulation endpoints are demo analytics. They do not override the stock reservation state machine.
