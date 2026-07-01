---
name: roast
description: Use when someone asks to roast an idea, pressure-test or stress-test an idea, validate a business idea, "convene the council", get a brutal second opinion before building something, or says "/roast". Spins up a 5-persona council that attacks the idea from every angle, then a Judge returns one GO / RESHAPE / KILL verdict with the cheapest test to de-risk it.
---

# roast — adversarial idea council

The default is to agree with you. `roast` is the opposite: convene five
independent persona agents who tear an idea apart from every angle, then YOU
(polly) act as Judge and synthesize one honest GO / RESHAPE / KILL verdict.
Use it before sinking time and money into building the wrong thing. The council
is adversarial on purpose — no persona hedges or is polite. The value is the
friction.

## Step 1 — Get the brief
If the idea is already in the request, start there. Then ask ONE batch of 3-4
clarifying questions (only what's missing):
1. The idea in 1-2 sentences (what it is, what it does).
2. Who it's for + how it makes money (the buyer + the price/model).
3. The user's edge — relevant skills, audience, or assets they already have.
4. Constraints — budget, timeline, how fast they need first dollar.
If the user says "just run it" or already gave enough, skip the questions —
don't over-interrogate. Write the brief as ONE short paragraph you paste
verbatim into every council member, so all five judge the same thing.

## Step 2 — Convene the council (5 personas, in parallel)
Dispatch the five personas as read-only explore tasks in a SINGLE turn — this
is exactly polly's 5-dispatch/turn cap, so do not add a sixth. Spread them
across the available workers; give the Researcher to `pi` (it can web-search
and run any gateway model). Each dispatch:
`sys_session_send(agent="claude_code"|"codex"|"pi", title="roast-<persona>",
args={purpose: "explore", input: "<persona mandate>  THE BRIEF: <brief>"})`.
Personas reason about an idea, not the repo — explore tasks only, never
implement; no worktree edits, no PRs.

Each persona returns: a one-line stance, its 3-5 sharpest points, the single
most important thing the user must hear, and a 1-10 score on its own dimension
(1 = walk away, 10 = no-brainer).

1. **Contrarian (Red Team)** — Assume it fails. Find the fatal flaws, the
   fastest way it dies, the load-bearing assumptions that are probably wrong.
   Ruthless and specific. No hedging, no "but it could work."
2. **Expansionist (Bull)** — Make the strongest case FOR. The 10x version,
   adjacent opportunities, unlock points the founder isn't seeing. Be specific
   about where the real money and leverage are.
3. **Logician (first principles)** — NO outside research, NO web. Reason from
   fundamentals: does the core mechanism make sense, do the incentives line up,
   does the math work in theory? Strip it to fundamentals; does it hold?
4. **Researcher (evidence)** — USE web search (best on `pi`). Real competitors,
   market size / demand signals, comparable pricing, whether the idea is
   validated or contradicted by what already exists. Cite what you find. Is the
   real world saying yes or no?
5. **Buyer (voice of customer)** — Role-play the exact target customer from the
   brief, in first person. Would you actually pay? What's your real objection?
   What makes you pick a competitor or just do nothing? What price feels right,
   what makes you say yes today? Honest and skeptical, not a cheerleader.

Collect all five via `sys_read_inbox`; inspect any empty/unclear run with
`sys_session_get_history` before judging.

## Step 3 — The Judge delivers the verdict
YOU (polly) are the Judge. Read every council member, weigh them, and make one
decisive call. Do NOT average the scores — name the real tension between the
personas and resolve it. Fold in the economics lens yourself: rough pricing,
realistic time-to-first-dollar, and whether the user can actually ship this
fast given the edge they described. Output exactly this shape:

```
## THE VERDICT: GO / RESHAPE / KILL
Confidence: [low / medium / high]

**The call in one line:** [the decision, plainly]

**Why:** [2-3 sentences resolving the council's tension]

**Biggest risk:** [the single thing most likely to kill it]
**Biggest upside:** [the strongest reason to do it]

**Money read:** [rough price, time-to-first-dollar, can they ship fast]

**The cheapest 48-hour test:** [the smallest, fastest thing they can do to
validate the riskiest assumption BEFORE building anything]

**If RESHAPE:** [the specific pivot that fixes the fatal flaw while keeping the upside]
```

Then list the five scores in one line:
`Contrarian X/10 · Expansionist X/10 · Logician X/10 · Researcher X/10 · Buyer X/10`.

## Rules
- Every persona stays in character; none softens. The friction is the point.
- The Judge must make an actual call. "It depends" is not a verdict — pick
  GO, RESHAPE, or KILL and own it.
- The cheapest 48-hour test is the most important output: it's how the user
  finds out if they're right without building the whole thing.
- Keep the final verdict skimmable. The council does the depth; the Judge does
  the decision.
