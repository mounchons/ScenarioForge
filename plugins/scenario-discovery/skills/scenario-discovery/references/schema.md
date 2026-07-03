# scenarios.json — Schema Reference

The full output shape of scenario-discovery. SKILL.md references this file when an agent needs
field-level detail. **Source of truth for this schema:** brain note "ScenarioForge - scenarios.json Schema".

> v1.1 (additive): ideation-panel fields — 3 new `contributor.role` values, `suggestion.kind`
> `open_question`, panel `raised_by` format, optional `contributor.provider_model`.
> Sync the brain note whenever this file changes.

## Full shape (annotated)

```jsonc
{
  "$schema": "https://scenarioforge/schemas/scenarios.v1.json",
  "meta": {
    "module": "billing",                       // module name (from user)
    "schema_version": "1.0.0",
    "generated_by": "scenario-discovery",
    "generated_at": "2026-06-13T14:00:00Z",    // ISO 8601 UTC
    "effort_scale": "STANDARD",                 // QUICK | STANDARD | ENTERPRISE
    "status": "draft"                           // draft | analyzing | validated | locked
  },
  "scenarios": [ /* ...see Scenario Object... */ ],
  "rollup": { /* ...see Rollup Object... */ }
}
```

## Scenario Object

```jsonc
{
  // -- identity (Aggregate Root) --
  "id": "SC-billing-001",          // SC-<module>-<nnn>, unique within the file
  "title": "Customer pays monthly subscription by credit card",
  "phase_origin": 1,               // scenario-discovery always sets 1
  "status": "draft",               // draft | needs_review | validated | locked

  // -- business{} (Phase 1 core — from the user only) --
  "business": {
    "actor": "Customer (subscriber)",          // must not be null
    "goal": "Pay successfully and receive a receipt", // must not be null
    "trigger": "Billing cycle due / pay button pressed",
    "preconditions": ["has active subscription", "has a card on file"],
    "postconditions": ["invoice=paid", "receipt sent"],  // must be measurable
    "business_value": "Protect recurring revenue, reduce churn",
    "priority": "high",                       // high | medium | low
    "has_ui": true,                           // true=has a screen -> ui-mockup. false=batch/API-only -> skip mockup
    "domain_concepts": ["Subscription","Invoice","Payment","Receipt"]
  },

  // -- traces_down{} (spine down to Phase 2-4 — scenario-discovery leaves empty) --
  "traces_down": {
    "user_stories": [], "use_cases": [], "acceptance_criteria": [],
    "entities": [], "pages": [], "apis": [], "features": [], "test_scenarios": []
    // these fields are filled by later-phase workers — discovery must not touch them
  },

  // -- analysis{} (Multi-Agent layer — discovery creates the empty shell, critic fills it) --
  "analysis": {
    "completeness": {
      "score": null,                  // 0..1 (null = not yet scored by a critic)
      "scored_by": null, "scored_at": null,
      "gaps": []                      // see Gap Object
    },
    "suggestions": [],                // see Suggestion Object
    "contributors": []                // see Contributor Object
  },

  // -- provenance{} --
  "provenance": {
    "source": "interview-2026-06-13", // req doc / interview / conversation
    "confidence": 0.9,                // 0..1 (lower it when fields are null)
    "human_validated": false          // must be true before status -> locked
  }
}
```

## Gap Object (filled by critic)
```jsonc
{
  "type": "missing_edge_case",   // enum below
  "severity": "high",            // high | medium | low
  "detail": "Does not cover a declined card",
  "raised_by": "scenario-critic"
}
```
**enum `type`:** `missing_edge_case` | `ambiguous` | `missing_precondition` |
`conflict` | `unmeasurable_postcondition` | `security`

## Suggestion Object (critic proposes — cannot commit)
```jsonc
{
  "id": "SUG-billing-001",
  "kind": "new_scenario",        // new_scenario | new_edge_case | split | merge | refine_field | open_question
  "proposed": { "title": "...", "rationale": "..." },   // open_question: title = the question to ask the user
  "raised_by": "scenario-critic",                       // panel personas: "<persona-id>@<provider>/<model>"
  "raised_at": "2026-06-13T14:05:00Z",
  "status": "pending",           // pending | accepted | rejected | merged
  "resolution": null             // user/orchestrator fills this on decision
}
```

## Contributor Object (audit — prevents agents re-looping)
```jsonc
{
  "agent": "scenario-critic",    // or an ideation-panel persona id, e.g. "domain-expert"
  "role": "completeness_review", // discovery | completeness_review | edge_case_expansion |
                                 // domain_validation | security_review |
                                 // domain_ideation | feasibility_review | scope_prioritization
  "provider_model": null,        // external persona only, e.g. "openrouter/google/gemini-2.5-flash"
  "ran_at": "2026-06-13T14:05:00Z",
  "verdict": "needs_more_edge_cases"
}
```

## Rollup Object (read model for the orchestrator gate)
```jsonc
{
  "total": 1,
  "by_status": { "draft": 1 },
  "avg_completeness": null,           // null if no critic score yet
  "open_gaps_high": 0,
  "pending_suggestions": 0,
  "ready_for_next_phase": false       // verify gate Phase 1->2
}
```

**Formula for `ready_for_next_phase`** (the orchestrator evaluates this, not discovery):
```
ready = open_gaps_high == 0
        AND pending_suggestions == 0
        AND every scenario.provenance.human_validated == true
```
scenario-discovery always sets `false` because Phase 1 just finished and has not yet passed
analysis + human validation.
