# World Cup 2026 Pool — Scoring Specification (v1.1)

Implementation spec for an automated scorer. Defines the data model, scoring
rules, edge cases, invariants, and test vectors. Language-agnostic; pseudocode
is illustrative.

**Changes in v1.1:** the third-place match is now scored (see §3.4).

---

## 1. Tournament structure

32-team single-elimination knockout, plus a third-place match.

Matches that **produce bracket advancers**:

| Round played (`round`) | Matches | Produces (teams reaching) |
|------------------------|--------:|---------------------------|
| `R32`                  | 16      | 16 teams → reach `R16`    |
| `R16`                  | 8       | 8 teams → reach `QF`      |
| `QF`                   | 4       | 4 teams → reach `SF`      |
| `SF`                   | 2       | 2 teams → reach `FINAL`   |
| `FINAL`                | 1       | 1 team → `CHAMPION`       |

Standalone match (**no bracket advancer**):

| Round played (`round`) | Matches | Notes |
|------------------------|--------:|-------|
| `THIRD`                | 1       | SF losers; `winner` = 3rd place. Scored via match bonuses only. |

**Total matches: 32.**

> **Two distinct keyings.** Bracket points are scored on the **round a team
> reaches** (`R16, QF, SF, FINAL, CHAMPION`). Match bonuses are scored on the
> **round a match is played in** (`R32, R16, QF, SF, FINAL, THIRD`). A match
> played in `R32` produces the teams that *reach* `R16`. `THIRD` produces no
> bracket advancer.

---

## 2. Data model

### 2.1 Actual results (ground truth)

```json
{
  "advancers": {
    "R16":      ["...16 team codes..."],
    "QF":       ["...8..."],
    "SF":       ["...4..."],
    "FINAL":    ["...2..."],
    "CHAMPION": "XXX"
  },
  "matches": [
    {
      "id": "R16-1",
      "round": "R16",
      "goals": { "BRA": 2, "ARG": 1 },   // end of EXTRA TIME, excludes shootout
      "winner": "BRA"                      // advancing team, INCLUDES shootout
    },
    {
      "id": "THIRD-1",
      "round": "THIRD",
      "goals": { "GER": 2, "NED": 0 },
      "winner": "GER"                      // 3rd place
    }
    // ... 32 matches total
  ]
}
```

- `goals` — goals at the end of extra time. Penalty-shootout goals are **never**
  included. A tie decided on penalties keeps its end-of-ET line (e.g. `1–1`).
- `winner` — the team that advanced (or, for `THIRD`, finished 3rd),
  **including** a penalty-shootout result.

### 2.2 Entry (one player submission)

```json
{
  "bracket": {
    "R16":      ["...16 teams predicted to reach R16..."],
    "QF":       ["...8..."],
    "SF":       ["...4..."],
    "FINAL":    ["...2..."],
    "CHAMPION": "XXX"
  },
  "match_predictions": [
    {
      "match_id": "R16-1",
      "pred_winner": "BRA",                // required for result bonus
      "pred_goals": { "BRA": 2, "ARG": 1 } // required for exact-score bonus
    }
    // one entry per actual match the player predicted, including THIRD
  ]
}
```

Match predictions are made on the **actual fixtures** (known round-by-round in
real time) and are scored **independently of bracket correctness**.

---

## 3. Scoring rules

### 3.1 Bracket — advancement points

For each round, award the per-team value for every team the entry correctly
placed in that round's advancer set (set intersection, order-independent).

| Round reached | Points per correct team |
|---------------|------------------------:|
| `R16`         | 4                       |
| `QF`          | 8                       |
| `SF`          | 16                      |
| `FINAL`       | 30                      |
| `CHAMPION`    | 55 (single team)        |

Buckets are independent and **stack**: a correctly predicted, bracket-coherent
champion scores in every round it appears (4 + 8 + 16 + 30 + 55 = 113).

### 3.2 Correct-result bonus

**+3 points** when `pred_winner == actual winner`.

- Winner is determined **including penalty shootouts**.
- **Excluded in `R32`** only. All other rounds — `R16, QF, SF, FINAL, THIRD` —
  are eligible.

### 3.3 Exact-score bonus

Awarded when `pred_goals == actual goals` (same teams, same goal counts;
orientation-safe via team-keyed comparison).

| Round played            | Exact-score points |
|-------------------------|-------------------:|
| `R32`                   | 2                  |
| `R16`                   | 1                  |
| `QF`                    | 1                  |
| `SF`                    | 1                  |
| `FINAL`                 | 1                  |
| `THIRD`                 | 1                  |

- Compared against the **end-of-ET** line, **excluding** shootout goals.

### 3.4 Third-place match

Scored as a standard `R16`-onward bonus match: eligible for the **+3 correct
result** bonus (§3.2) and the **+1 exact score** bonus (§3.3). It does **not**
contribute bracket advancement points (§3.1), because it decides placement, not
progression. Maximum from the third-place match: **4 points**.

> **Optional variant (off by default).** If the pool wants extra weight on the
> podium, add a dedicated bracket bonus `THIRD_PLACE_PTS` for correctly naming
> the 3rd-place team. Note this **overlaps** with the §3.2 result bonus on the
> same match — enable only if intentional. Default `THIRD_PLACE_PTS = 0`.

The result bonus and exact-score bonus remain **independent**: a single match
can award both, one, or neither.

---

## 4. Scoring algorithm

```python
BRACKET_PTS   = {"R16": 4, "QF": 8, "SF": 16, "FINAL": 30}
CHAMPION_PTS  = 55
RESULT_PTS    = 3
RESULT_EXCLUDED_ROUNDS = {"R32"}
EXACT_PTS     = {"R32": 2, "R16": 1, "QF": 1, "SF": 1, "FINAL": 1, "THIRD": 1}

# optional podium bracket bonus (default off)
THIRD_PLACE_PTS = 0   # set > 0 to also reward naming the 3rd-place team

def score_entry(entry, actual):
    pts = 0

    # --- 3.1 Bracket (round reached) ---
    for rnd, p in BRACKET_PTS.items():
        correct = set(entry["bracket"][rnd]) & set(actual["advancers"][rnd])
        pts += len(correct) * p
    if entry["bracket"]["CHAMPION"] == actual["advancers"]["CHAMPION"]:
        pts += CHAMPION_PTS

    # --- optional podium bonus ---
    if THIRD_PLACE_PTS and entry["bracket"].get("THIRD") \
       and entry["bracket"]["THIRD"] == actual["advancers"].get("THIRD"):
        pts += THIRD_PLACE_PTS

    # --- 3.2 / 3.3 Match bonuses (round played) ---
    preds = {mp["match_id"]: mp for mp in entry["match_predictions"]}
    for m in actual["matches"]:
        mp = preds.get(m["id"])
        if mp is None:
            continue
        # correct result (winner incl. shootout), not in R32; THIRD eligible
        if m["round"] not in RESULT_EXCLUDED_ROUNDS \
           and mp.get("pred_winner") == m["winner"]:
            pts += RESULT_PTS
        # exact score (end of ET, excl. shootout)
        if mp.get("pred_goals") == m["goals"]:
            pts += EXACT_PTS[m["round"]]

    return pts
```

`pred_goals == goals` is a dict equality: identical team keys and identical
integer values.

---

## 5. Edge cases

| Case | Result bonus | Exact-score bonus |
|------|--------------|-------------------|
| Win in regulation 3–0, predicted winner + 3–0 | +3 (if eligible) | + round value |
| Win in ET 2–1 (was 1–1 at 90'), predicted 2–1 | +3 (if eligible) | + round value (line is `2–1`) |
| Tie 1–1, decided on penalties; predicted winner correct, predicted `1–1` | +3 (if eligible) | + round value (line is `1–1`) |
| Tie 1–1 on pens; predicted `2–1` for the eventual winner | +3 (if eligible) | **+0** (line was `1–1`) |
| Predicted `2–1` BRA, actual `1–2` BRA (reversed) | depends on winner | **+0** (goals per team don't match) |
| Any `R32` match, result predicted correctly | **+0** (excluded) | +2 (if exact) |
| `THIRD` match, result predicted correctly | **+3** | +1 (if exact) |
| No prediction submitted for a match | +0 | +0 |

"Eligible" = any round except `R32`.

---

## 6. Validation invariants

A correct implementation (with default `THIRD_PLACE_PTS = 0`) must satisfy:

```
bracket_max  = 16*4 + 8*8 + 4*16 + 2*30 + 55              = 307
result_max   = 16*3                                        = 48   # R16,QF,SF,FINAL,THIRD
exact_max    = 16*2 + 16*1                                  = 48   # R32=2; 16 matches @1
TOTAL_MAX                                                    = 403

match_count  = {R32:16, R16:8, QF:4, SF:2, FINAL:1, THIRD:1} = 32
result_eligible_matches = 16                                       # excludes R32
```

A perfect entry (every advancer, every winner, every exact score) scores
exactly **403**.

---

## 7. Test vectors

Unit-level cases for a harness. Each lists the relevant input fragment and the
expected point delta.

**T1 — Bracket champion**
`bracket.CHAMPION = "FRA"`, `actual.CHAMPION = "FRA"` → **+55**.
`actual.CHAMPION = "ESP"` → **+0**.

**T2 — Bracket finalists (partial)**
`bracket.FINAL = ["FRA","BRA"]`, `actual.FINAL = ["FRA","ESP"]`
→ 1 correct × 30 = **+30**.

**T3 — Bracket R16 (set intersection)**
12 of the 16 predicted teams reached R16 → 12 × 4 = **+48**.

**T4 — Result bonus, R16, win on penalties**
match `{round:"R16", winner:"BRA"}`, `pred_winner:"BRA"` → **+3**.

**T5 — Result bonus excluded in R32**
match `{round:"R32", winner:"BRA"}`, `pred_winner:"BRA"` → **+0**.

**T6 — Exact score R32**
match `{round:"R32", goals:{BRA:2,ARG:1}}`, `pred_goals:{BRA:2,ARG:1}` → **+2**.

**T7 — Exact score R16+**
match `{round:"QF", goals:{ESP:0,GER:0}}`, `pred_goals:{ESP:0,GER:0}` → **+1**.

**T8 — Exact score, ET line vs shootout**
match `{round:"SF", goals:{FRA:1,POR:1}, winner:"FRA"}` (FRA win on pens),
`pred_goals:{FRA:1,POR:1}` → exact **+1**; with `pred_winner:"FRA"` also result
**+3**; total **+4**.

**T9 — Exact score reversed orientation**
match `goals:{BRA:1,ARG:2}`, `pred_goals:{BRA:2,ARG:1}` → **+0**.

**T10 — Combined single R16 match, exact + result**
match `{round:"R16", goals:{BRA:2,ARG:1}, winner:"BRA"}`,
pred `{pred_winner:"BRA", pred_goals:{BRA:2,ARG:1}}` → **+4** (3 + 1).

**T11 — Combined, result only (wrong scoreline)**
same as T10 but actual `goals:{BRA:3,ARG:1}` → **+3** (result only).

**T12 — Third-place match, full credit**
match `{round:"THIRD", goals:{GER:2,NED:0}, winner:"GER"}`,
pred `{pred_winner:"GER", pred_goals:{GER:2,NED:0}}` → **+4** (3 result + 1 exact).

**T13 — Third-place match, no bracket advancement points**
`THIRD` correctness contributes **0** bracket points when
`THIRD_PLACE_PTS = 0` (default).

---

*End of specification v1.1.*
