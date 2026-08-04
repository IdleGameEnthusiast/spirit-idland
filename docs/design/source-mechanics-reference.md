# Source Mechanics Reference (Public Summaries)

This note anchors high-level mechanics for close-style adaptation while keeping implementation text original.

## Current Prototype Scope Note

- The live build currently implements only a narrow River-focused slice.
- Implemented mechanics in the browser are documented in the spec pack under `docs/spec` and take precedence over older exploratory roadmap ideas.
- This file remains a terminology and adaptation guardrail, not a full gameplay spec.

## Sources Used

- Wikipedia board game summary page for Spirit Island (high-level gameplay only).
- BoardGameGeek public description text and metadata snippets.

## EN/DE Terminology Baseline (for this prototype)

These mappings are the baseline for German-first UI text and future mechanic steps.
Confidence levels are based on agreement between EN/DE public summaries and known publisher usage in German community references.

### Core Mechanics

| English | German | Confidence | Notes |
| --- | --- | --- | --- |
| Spirit | Geist | High | Used consistently in DE summary and product listings. |
| Invader | Invasor | High | DE summary explicitly uses "Invasoren". |
| Fear | Furcht | High | DE summary explicitly uses "Furcht" / "Furcht-Punkte". |
| Blight | Oednis / Veroedung | Medium | DE summary uses both concept words; game component naming can vary by print. |
| Presence | Praesenz | High | DE summary uses "Praesenz" for spirit presence. |
| Explore | Erkunden | High | DE summary: Invaders "erkundet" terrain. |
| Build | Bebauen | High | DE summary: Invaders "bebaut" terrain. |
| Ravage | Verwuesten | High | DE summary: Invaders "verwuestet" terrain. |
| Event | Ereignis | High | DE expansion text uses events as "Events/Ereignisse". |
| Growth | Wachstum | Medium | Derived from rules concept, not always UI label in summaries. |
| Power Card | Faehigkeitenkarte / Machtkarte | Medium | Card terminology differs across fan aids and editions. |
| Defend | Verteidigen / Schuetzen | Medium | Functional translation; exact keyword formatting may vary by print. |
| Push | Verschieben / Wegdruecken | Medium | Functional translation; exact templating depends on card wording. |
| Destroy | Zerstoeren | High | Standard German boardgame term and summary-consistent. |

### Starter Spirit (locked for Step 1)

| English | German | Confidence | Notes |
| --- | --- | --- | --- |
| River Surges in Sunlight | Reissende Fluten im Sonnenlicht | Medium | German rendering should be verified against the exact local print edition you want to mirror. |

### Scope Note

- This glossary is intentionally limited to mechanic/system labels for implementation.
- We avoid copying rulebook/card text and keep gameplay copy original.

## Mechanics Anchors

- Spirits oppose invaders on an island map.
- Invader pressure escalates in staged patterns over time.
- Energy is spent to execute growth and power decisions.
- Fear progression can ease victory conditions.
- Land degradation pressure (blight style) is not implemented in the current prototype, but remains a possible future axis.
- Spirits become stronger over the run through progression and unlocks.

## Adaptation Policy

- Keep mechanical patterns close at the system level.
- Do not copy official rulebook wording, card text, names of proprietary powers, or visual assets.
- Keep all implementation constants and wording project-specific.

## Usage

- Use this reference only for directional consistency.
- Prefer the local spec pack as single source of truth for implementation decisions.
