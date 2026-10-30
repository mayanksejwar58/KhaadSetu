# Data dictionary

## Centres

`code`, `name`, `district`, `state`, and `active`. Stable `code` values map operational depots independently of database IDs.

## Inventories

`centre`, `productCode`, `physicalStockBags`, `reservedStockBags`, `bagWeightKg`, optional reconciliation timestamp and note. Available bags are derived as physical minus reserved; they are not stored independently.

## Fertilizer requests

`requestCode`, synthetic `farmerDemoId`, `centre`, `productCode`, `quantityBags`, lifecycle `status`, unique `idempotencyKey`, optional expiry, waitlist position, and audit note. OTPs are deliberately absent from the public schema.

## Agronomic guidelines

Versioned rule code, crop, product, jurisdiction, season, commercial product rate in kg/ha, source title/reference, reviewer identity and role, approval/effective dates, limitations, and approval flag. The registry is empty until reviewed source records are supplied.

## Quota policies

Versioned policy code, jurisdiction, product, maximum bags, effective dates, source reference, approver, and lifecycle status. No default quota exists.

## Forecast input

4–104 ordered weekly, non-negative demand values in kg; horizon 1–4; current stock kg; incoming stock kg; and arrival week. Missing history is not inferred. The current endpoint does not reconstruct censored demand.

## Soil report review

The UI exposes available N/P/K, pH, organic carbon, and electrical conductivity with explicit units. Missing values remain empty. Crop and parcel context are not represented as laboratory measurements.
