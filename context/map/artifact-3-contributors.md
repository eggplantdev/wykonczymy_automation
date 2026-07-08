# Artifact 3 — Contributors (git)

> Wide Scan / "who knows what" signal for the Project Map. Evidence from `git log`
> author + co-author fields over the full history (2026-02-11 → 2026-07-08, 975 commits).
> Bots and agent commits are filtered from _authorship_ per the M4L2 method.

## Headline: this is a single-human repo

The contributor map, designed for multi-developer legacy codebases, **collapses here** —
there is exactly one human author:

| Author                                                   | Commits | Identity                                     |
| -------------------------------------------------------- | ------- | -------------------------------------------- |
| ex-Plant `<konradantonik@gmail.com>`                     | 963     | Konrad Antonik (local git)                   |
| ex-Plant `<104215784+ex-Plant@users.noreply.github.com>` | 12      | **same person**, GitHub web/noreply identity |

So the M4L2 question "who do I ask about area X?" has one answer for **every** area:
**Konrad**. There is no knowledge distribution to map and no support line to route.

For onboarding, the finding is: there is no bus-factor redundancy. Every area's tribal
knowledge lives with one person. That raises the value of the durable docs
(`AGENTS.md`, `context/foundation/*`, this map) — they are the _only_ second source of truth.

## The real "contributors" here are AI agents

704 of 975 commits (**72%**) carry a Claude co-author. Agent breakdown:

| Agent                      | Co-authored commits |
| -------------------------- | ------------------- |
| Claude Opus 4.6 (+ 1M ctx) | 328                 |
| Claude Opus 4.8 (+ 1M ctx) | 226                 |
| Claude Opus 4.7 (+ 1M ctx) | 119                 |
| Claude Sonnet 4.6          | 20                  |
| Claude Fable 5             | 11                  |

Implication for whoever inherits this: most code was pair-authored with an agent against
the rules in `AGENTS.md`. To "ask about" an area, the practical move is to re-run the same
loop — read the area's `context/` docs and the relevant `AGENTS.md` section, then work with
an agent — rather than to find a second human expert (there isn't one).

## Where the one contributor is currently warm (last 30 days)

Recency proxies "what Konrad has most in his head _right now_":

| Area                   | Commits (30d) |
| ---------------------- | ------------- |
| `components/ui`        | 137           |
| `components/forms`     | 53            |
| `lib/actions`          | 44            |
| `app/(frontend)`       | 44            |
| `lib/leads`            | 41            |
| `lib/queries`          | 39            |
| `lib/db`               | 27            |
| `lib/google`           | 22            |
| `lib/constants`        | 21            |
| `components/transfers` | 17            |

Cross-referenced with artifact-1's phases: the warm set is the July front (leads + UI
refresh) plus the always-hot transfer/finance spine. Anything **not** on this list
(e.g. `lib/auth`, `access`, older settlement code) is colder — expect the author to need
a re-read before changing it, same as a newcomer would.

## Unknowns (what author history cannot show)

- **Co-author ≠ reviewer.** The Claude co-author tag marks pair-authoring, not independent
  review. Nothing here had a second _human_ set of eyes.
- **Squashed history hides sub-authorship** — if any early work was squashed, per-area
  attribution is coarser than reality.
- **"Warm" is activity, not mastery.** High recent churn can mean deep familiarity _or_
  an area actively being wrestled with. Pair with artifact-2 stability to tell them apart.
- **No external contributors** — no forks/PRs from others appear in local history; if the
  GitHub repo has unmerged external PRs, they are invisible here.
