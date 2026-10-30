# Allotment, booking and token lifecycle

## User journey

1. A farmer uploads a soil report; browser OCR extracts selectable PDF text or OCRs scanned pages/images.
2. The farmer checks N/P/K, organic carbon, pH and EC against the source report and submits the verified readings.
3. The operator views the shared report queue, selects fertilizer product, bag size and a crop/region/season-specific approved rate, then supplies a source reference and explicitly acknowledges the guideline check.
4. The system computes:

   `area_ha = area_acres × 0.4046856422`

   `total_kg = area_ha × approved_product_rate_kg_per_ha`

   `bags_to_book = ceil(total_kg / retail_bag_weight_kg)`

5. Farmer chooses a depot and requests the complete recommended bag count.
6. The allotment service verifies the report/recommendation/depot/product/bag-size and quantity match. It reserves stock atomically within the single server process, or places the whole request on the FIFO waitlist.
7. A human-readable token code is created for both reserved and waitlisted requests. A six-character OTP is generated only for a real stock reservation.
8. The farmer confirms a RESERVED token within 20 minutes. The farmer shows the OTP at collection.
9. The operator must be assigned to that depot, selects the CONFIRMED token, and enters the OTP. On a valid match, the service marks CLAIMED and reduces both physical and reserved bags in one update.
10. An expired or cancelled reservation releases reserved bags and invokes FIFO promotion. A depot physical-count reconciliation can add stock and promote whole waitlisted requests that now fit.

## State transition rules

| From | To | Trigger |
|---|---|---|
| new request | RESERVED | Enough stock for the complete bag count |
| new request | WAITLISTED | Not enough stock for the complete bag count |
| WAITLISTED | RESERVED | FIFO head can be fully satisfied after stock release/reconciliation |
| RESERVED | CONFIRMED | Farmer confirms active token |
| CONFIRMED | CLAIMED | Assigned operator submits correct OTP |
| RESERVED / CONFIRMED | EXPIRED | 20-minute reservation window passes |
| WAITLISTED / RESERVED / CONFIRMED | CANCELLED | Farmer cancels |

`CLAIMED`, `EXPIRED` and `CANCELLED` are terminal. Each successful transition appends an audit event to the booking record.

## Stock invariants

- `available_bags = physical_stock_bags - reserved_stock_bags`.
- `reserved_stock_bags` cannot exceed physical stock.
- A request is never partially reserved.
- A waitlisted request does not lock inventory.
- Confirmation changes only token status.
- Only OTP redemption decrements physical stock.
- Redemption decrements both physical and reserved stock by the same full quantity.
- Physical reconciliation cannot undercut active reservations.
- FIFO order is scoped to the same depot and product; the service does not skip an unsatisfied head request.

## Demo-only boundaries

Demo inventory is generated sample data. No official depot stock, government token, Aadhaar identity, subsidy entitlement, or payment is represented. Demo OTP is not an SMS OTP. Browser OCR is for extracting text, not for verifying a laboratory result. The JSON store is a one-instance demo store; it must move to a transactional DB for multi-instance/public production.
