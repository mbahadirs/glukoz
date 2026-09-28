# Metrics and definitions

All calculations live in [`packages/metrics`](../packages/metrics) as pure, unit-tested functions. The server
computes reports; the browser only converts units and draws. Glucose is handled in mg/dL internally;
mmol/L = mg/dL ÷ 18.0182 (one decimal).

> These are implementations of published definitions for information only — not validated clinical tools.
> See [DISCLAIMER.md](../DISCLAIMER.md). References are listed at the end and in
> [ACKNOWLEDGMENTS.md](../ACKNOWLEDGMENTS.md).

## Pre-processing: 5-minute slots

Readings arrive at irregular intervals (about every minute for current values, every 15 minutes for history).
Averaging them directly would over-weight dense periods, so:

1. Time is split into 5-minute slots in **UTC**; each slot's value is the mean of its readings.
2. Empty slots are **not** interpolated. Charts connect gaps up to 20 minutes and break the line for longer gaps.
3. All percentages are computed over **filled** slots.
4. **Data sufficiency** = filled slots ÷ expected slots. Below 70 % the report shows a warning that metrics may
   be misleading (consensus recommends ≥ 70 % of 14 days).

## Summary statistics

| Metric         | Definition                                       |
| -------------- | ------------------------------------------------ |
| Mean glucose   | Mean of slot values                              |
| SD             | Sample standard deviation (n − 1)                |
| **CV**         | SD ÷ mean × 100. ≤ 36 % is considered stable [3] |
| **GMI** (%)    | 3.31 + 0.02392 × mean (mg/dL) [4]                |
| GMI (mmol/mol) | 12.71 + 4.70587 × mean (mmol/L) [4]              |
| Median, IQR    | Linear-interpolation percentiles (type 7)        |

## Time in ranges

International consensus bands [1] — always used for reports, independent of the patient's personal target:

| Band                    | Range (mg/dL) | Consensus goal (most adults with T1D/T2D) |
| ----------------------- | ------------- | ----------------------------------------- |
| Very low (TBR level 2)  | < 54          | < 1 %                                     |
| Low (TBR level 1)       | 54–69         | < 4 % together with very low              |
| **In range (TIR)**      | 70–180        | > 70 %                                    |
| High (TAR level 1)      | 181–250       | < 25 % together with very high            |
| Very high (TAR level 2) | > 250         | < 5 %                                     |
| Tight range (TITR)      | 70–140        | informational                             |

Each percentage is also shown as time per day (e.g. 4 % ≈ 58 min/day). The personal target band (editable per
patient, with presets such as 63–140 mg/dL for pregnancy) only affects the chart band and the "in target"
figure. Goals for older / high-risk adults (TIR > 50 %, < 70 mg/dL < 1 %, > 250 mg/dL < 10 %) are defined in
`packages/shared` but not yet selectable in the UI.

## Glycaemic events

Detected on 5-minute slots (defaults, all configurable in code) following the event definitions of [2]:

| Event        | Starts                   | Ends                     |
| ------------ | ------------------------ | ------------------------ |
| Hypo level 1 | < 70 mg/dL for ≥ 15 min  | ≥ 70 mg/dL for ≥ 15 min  |
| Hypo level 2 | < 54 mg/dL for ≥ 15 min  | ≥ 54 mg/dL for ≥ 15 min  |
| Hyper        | > 250 mg/dL for ≥ 15 min | ≤ 250 mg/dL for ≥ 15 min |

- **Prolonged:** level-2 hypo or hyper lasting ≥ 120 minutes.
- **Nocturnal:** the event starts between 00:00 and 06:00 in the patient's time zone.
- A data gap longer than 20 minutes ends a running event. Each event records start, end, duration and the
  extreme value (nadir or peak).

## Risk indices

**Glycemia Risk Index (GRI)** [5], with percentages 0–100:

```
hypo  = veryLow + 0.8 × low
hyper = veryHigh + 0.5 × high
GRI   = min(100, 3 × hypo + 1.6 × hyper)
```

Zones: A 0–20, B 20–40, C 40–60, D 60–80, E 80–100. The report plots hypo vs hyper components on a GRI grid.

**LBGI / HBGI** [6]:

```
f(g) = 1.509 × ((ln g)^1.084 − 5.381)      g in mg/dL
r(g) = 10 × f(g)²
LBGI = mean of r(g) where f(g) < 0,  HBGI = mean of r(g) where f(g) > 0
```

## Ambulatory Glucose Profile (AGP)

- Slot values are placed on the **time of day in the patient's time zone**, in 96 buckets of 15 minutes.
- For each bucket, the 5th, 25th, 50th, 75th and 95th percentiles are computed.
- Curves are smoothed with a centred 3-bucket moving average (circular across midnight); empty neighbours are
  ignored. Buckets with fewer than 5 values are left empty.
- Chart: light band 5–95 %, dark band 25–75 %, bold median, reference lines at 70 and 180 mg/dL, target band.
- This is an independent implementation inspired by the AGP report of the International Diabetes Center; it is
  not an official AGP report.

## Other analyses

| Analysis           | Definition                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily summaries    | Per local day: mean, min, max, time in ranges, event count, sufficiency                                                                                                                                                                                                            |
| Time of day        | Night 00–06, morning 06–12, afternoon 12–18, evening 18–24: mean, TIR, hypo count                                                                                                                                                                                                  |
| Weekday            | Monday–Sunday: mean and TIR                                                                                                                                                                                                                                                        |
| Hour × day heatmap | Per local hour and day: mean and minutes outside 70–180 mg/dL                                                                                                                                                                                                                      |
| Period comparison  | Current vs the previous period of equal length. TIR, TITR and sufficiency: higher is better; TBR, TAR, CV, GRI and hypo count: lower is better; mean and GMI are shown as neutral (a decrease can also mean more lows). Direction is shown with arrows and text, not colour alone. |
| Post-meal analysis | For meal notes: pre-meal mean (−15…0 min), values nearest to +60 and +120 min (± 10 min), peak and time to peak within 180 min; averaged by meal type inferred from local time (breakfast 05–11, lunch 11–16, dinner 16–22, otherwise snack)                                       |
| Rate of change     | Between consecutive slots, mg/dL/min (gaps > 15 min skipped)                                                                                                                                                                                                                       |

## Live view helpers

- **Delta:** latest reading minus the reading closest to 5 minutes earlier (searched 3–8 minutes back).
- **Data frequency:** median interval between readings in the last hour.
- **Trend between two points:** change, duration and average rate between two readings the user selects; the
  slope is extended 30 minutes as a dotted line.
- **Projection** (optional, can be turned off): least-squares line over the last 20 minutes (≥ 3 readings, latest
  ≤ 10 minutes old), extended up to 30 minutes. Uncertainty band =
  `max(t(0.975, n−2) × prediction standard error, 4 + 0.35 × minutes ahead)` mg/dL; values clamped to 40–400.
  The lower bound is a heuristic so that the band never looks misleadingly narrow. **It ignores meals, insulin,
  exercise and sensor lag, and must not be used for treatment decisions.**

## References

1. Battelino T, Danne T, Bergenstal RM, et al. Clinical Targets for Continuous Glucose Monitoring Data
   Interpretation: Recommendations From the International Consensus on Time in Range. _Diabetes Care._
   2019;42(8):1593–1603.
2. Battelino T, Alexander CM, Amiel SA, et al. Continuous glucose monitoring and metrics for clinical trials: an
   international consensus statement. _Lancet Diabetes Endocrinol._ 2023;11(1):42–57.
3. Danne T, Nimri R, Battelino T, et al. International Consensus on Use of Continuous Glucose Monitoring.
   _Diabetes Care._ 2017;40(12):1631–1640.
4. Bergenstal RM, Beck RW, Close KL, et al. Glucose Management Indicator (GMI): A New Term for Estimating A1C From
   Continuous Glucose Monitoring. _Diabetes Care._ 2018;41(11):2275–2280.
5. Klonoff DC, Wang J, Rodbard D, et al. A Glycemia Risk Index (GRI) of Hypoglycemia and Hyperglycemia for
   Continuous Glucose Monitoring Validated by Clinician Ratings. _J Diabetes Sci Technol._ 2023;17(5):1226–1242.
6. Kovatchev BP, Cox DJ, Gonder-Frederick LA, Clarke W. Symmetrization of the blood glucose measurement scale and
   its applications. _Diabetes Care._ 1997;20(11):1655–1658.
