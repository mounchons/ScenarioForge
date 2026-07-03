# Discovery Questions — requirement gathering order

The question set scenario-discovery uses to fill each scenario's `business{}`.
Principle: **ask one group at a time, never all at once** to avoid user fatigue and get considered answers.

## Before asking: get the scenarios split first

Read the raw requirements; find each "goal an actor wants to accomplish" = 1 scenario.
If you cannot split them yet, ask the user:
> "What are the main jobs users need to accomplish in this module? List them out."

Then confirm the scenario list with the user before going into detail (avoids working in the wrong
direction and wasting time).

## Question groups (ask per scenario, one group at a time)

### Group A — actor + goal (do not skip, must not be null)
- "Who performs this scenario?" → `actor`
- "What does it accomplish?" → `goal`

### Group B — trigger + preconditions
- "When does it start / what triggers it?" → `trigger`
- "What must be in place before it can start?" → `preconditions[]`
  (e.g. logged in, has seed data, has permission)

### Group C — postconditions (emphasize measurability)
- "When it finishes, what state changes / what condition should the system be in?" → `postconditions[]`
- If the user answers vaguely ("it just works") → push for measurability:
  > "How do we measure that it worked? What record is created/updated, or what does the user receive?"
- **Why it must be measurable:** qa-scenario-gen derives tests (TS-xxx) from these postconditions

### Group D — value + priority + UI
- "Why does this scenario matter to the business?" → `business_value`
- "Compared to other scenarios, how important is it (high/medium/low)?" → `priority`
- "Does this scenario have a screen the user interacts with, or is it background/batch/API-only?" → `has_ui`
  (true = orchestrator will delegate ui-mockup; false = skip ui-mockup)

### Group E — domain concepts (ties into the user's DDD)
- "What business things/concepts does this scenario touch?" → `domain_concepts[]`
  (e.g. Invoice, Payment, Subscription — these become the seed for entities in the next phase)

## Event-first elicitation (Event Storming mode)

When requirements are vague, process-heavy, or Group C keeps getting vague answers ("it just
works"), switch the interview to Alberto Brandolini's order — mine **events first**, then work
outward. Domain people recall events naturally, and each maps straight onto `business{}`:

1. "Walk me through this module as things that HAPPENED, past tense — 'invoice was paid',
   'subscription was cancelled'. Which events matter?" → the event list
2. Per event: "What action caused it, and who performed it?" → command + actor → Group A (`actor`,
   `goal`) and Group B (`trigger`)
3. Per event: "What must already be true for it to happen?" → `preconditions[]` (Group B)
4. The events themselves ARE measurable postconditions — "invoice=paid" arrives for free, already
   in the shape Group C fights for and qa-* derives tests from
5. "When <event> happens, what must the system do next?" (policies) → often a missing scenario or
   edge case the user never stated
6. The nouns inside the events (Invoice, Payment, ...) → `domain_concepts[]` (Group E); clusters of
   nouns hint at module / bounded-context boundaries for domain-design
7. Put the events on a timeline: a gap between two events reveals a missing scenario; one
   actor+goal per event chain confirms the split rule (unrelated chains in one story → split)

## When the user cannot answer

- Do not guess on their behalf → set the field to `null`
- Lower `provenance.confidence` proportionally to the missing fields
- Note it as a slot the critic agent should catch (it becomes a gap in beat 2)
- Tell the user plainly: "I'll leave this blank for now; the analysis pass will help flag what to fill."

## Fatigue-reduction techniques

- If several scenarios are similar, ask the first one in detail, then ask the rest by diff:
  > "How does this one differ from SC-xxx? Is the rest the same?"
- Confirm in batches: summarize the captured business{} back to the user before saving
- If requirements already arrive as a complete document → pull answers from it, then ask only for the
  fields you could not find

## Example dialogue (abridged)

> Worker: What are the main jobs in this module?
> User: Pay monthly, view payment history, cancel subscription
> Worker: That's 3 scenarios — SC-billing-001/002/003. Starting with 001, payment:
>         who performs it and what do they want to accomplish?
> User: The customer, they want to pay and get a receipt
> Worker: When does payment start — automatically at billing cycle, or pressed manually?
> ...
