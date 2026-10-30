# Model card: Demand Forecast

- **Task:** forecast weekly depot/product demand and calculate stock sufficiency.
- **Active method:** `damped_trend_history_baseline`.
- **Training:** none; this is a transparent statistical baseline.
- **Input:** 4–104 ordered weekly demand observations plus stock and timed incoming supply.
- **Horizon:** 1–4 weeks.
- **Output:** predicted demand, opening stock, incoming quantity, expected fulfilment, shortfall, closing stock, and qualitative risk.
- **Provenance:** manual or synthetic demo input.
- **Production ready:** no.
- **Limitations:** no seasonality model, no confidence intervals, no automatic missing-week detection, and no correction for stockout-censored sales. Demo values must not drive procurement or allocation.
