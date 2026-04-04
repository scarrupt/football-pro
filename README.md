# U14 Girls Academy — Training Programme Data

## Overview
This file (`u14_academy_sessions.json`) contains the complete structured data for a U14 girls academy individual training programme. It is designed to be consumed by a web or mobile application.

---

## File structure

```
u14_academy_sessions.json
├── meta                          # Programme metadata
└── sessions[]                    # Array of all training sessions
    ├── shooting                  # Levels: easy / medium / hard
    ├── passing                   # Levels: easy / medium / hard
    ├── dribbling                 # 6 modules (pick one per day)
    ├── fifa_11plus               # 3 parts, 15 exercises, 3 levels each
    ├── upper_body_strength       # 4 exercises
    ├── lower_body_strength       # 4 exercises
    ├── speed_training            # 3 blocks
    ├── rhythmic_movement         # 4 blocks
    └── football_intelligence     # Match watching framework
```

---

## Session schemas

### Shooting & Passing (`levels[]`)
Sessions with difficulty tiers. Each level has:
- `activation[]` — warm-up items
- `drills[]` — array of drills with sets, reps, rest, cues, setup

### Dribbling (`modules[]`)
6 standalone modules. Each module has:
- `activation[]`
- `drills[]`
- `tests[]` — progress tests with type `"timed"`

### FIFA 11+ (`parts[]`)
3 parts. Part 2 exercises have `levels[]` (1, 2, 3) for progression.
- `acl_warning: true` flags exercises critical for knee safety

### Strength — Upper & Lower (`exercises[]`)
Flat array of exercises with:
- `tempo` — e.g. `"3-2-0"`, `"explosive"`, `"controlled"`
- `tempo_description` — human readable explanation
- `muscles[]` — primary muscles worked
- `acl_warning` — boolean

### Speed Training (`blocks[]`)
3 sequential blocks:
- Block 1: wall mechanics (`exercises[]`)
- Block 2: plyometrics (`exercises[]`)
- Block 3: sprints (flat object with `count`, `distance_m`, `start_variations[]`)

### Rhythmic Movement (`blocks[]`)
4 blocks. Exercises have:
- `beat_pattern` — the rhythmic cue string
- `bpm` — target beats per minute
- `duration_sec` or `reps`

### Football Intelligence
Flat structure with:
- `focal_points[]` — 4 watching focus areas (A, B, C, D)
- `during_tasks[]` — active tasks during the match
- `after_stages[]` — 3-stage post-match debrief

---

## Key field reference

| Field | Type | Meaning |
|---|---|---|
| `sets` | number | Number of sets |
| `reps` | number | Reps per set |
| `reps_range` | [min, max] | Rep range e.g. [5, 10] |
| `reps_unit` | string | "makes", "reps", "jumps" |
| `rest_seconds` | number | Rest between sets in seconds |
| `duration_sec` | number | Duration of hold/interval in seconds |
| `duration_work_sec` | number | Work interval (interval training) |
| `duration_rest_sec` | number | Rest interval (interval training) |
| `tempo` | string | e.g. "3-2-0", "explosive", "controlled" |
| `feet` | string | "left", "right", "both" |
| `each_side` | boolean | Reps are per side |
| `per_leg` | boolean | Reps are per leg |
| `requires_partner` | boolean | Partner required |
| `acl_warning` | boolean | Knee alignment warning applies |
| `type` (test) | string | "timed" |

---

## Suggested app features

### Session player
- Tab through levels or modules
- Show sets/reps with a built-in rest timer
- Display coaching cues one at a time
- ACL warning overlay for flagged exercises

### Progress tracker
- Store timed test results (T1, T2, shuttle, etc.)
- Graph improvement over sessions
- Compare left foot vs right foot

### Weekly planner
- Assign sessions to days of the week
- Enforce FIFA 11+ frequency (min 2× per week)
- Balance categories across the week

### Match watching log
- Guided worksheet with the focal point selector
- Tally counter for during-match task
- Post-match debrief notes saved per match

---

## Notes for development

- All distances are in **metres** unless field is named `_ft`
- BPM values are strings (e.g. `"80–100"`) or numbers
- `acl_warning: true` should always render a visible warning in the UI
- The dribbling session has 6 modules — the app should allow the user to pick one per day
- FIFA 11+ has a `pre_match_protocol` field — implement a separate pre-match mode
- The `football_intelligence` session has no sets/reps — it is a structured guide, not a drill session
