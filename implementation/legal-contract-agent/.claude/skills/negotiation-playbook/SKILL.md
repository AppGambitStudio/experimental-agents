---
description: Contract negotiation strategy generator — priority-ordered playbook with talking points, alternative clause language, and leverage analysis. Auto-invoked when user asks about negotiation strategy or pushback.
---

# Negotiation Playbook Skill

## Playbook Structure

Each item in the playbook should include:

1. **Priority** — rank by business impact (critical first)
2. **Clause Reference** — section number and title from the contract
3. **Risk Level** — critical / high / medium
4. **Current Text** — exact quote from the contract
5. **Issue** — plain-language explanation of the problem
6. **Legal Basis** — Indian law reference supporting your position
7. **Talking Point** — what to say to the counterparty (conversational, not legalistic)
8. **Suggested Alternative** — replacement clause language
9. **Fallback Position** — minimum acceptable outcome if they push back
10. **Leverage** — legal leverage (void under law) vs commercial leverage (industry standard)

## Priority Ordering Rules

1. Void clauses first (Section 27 non-compete, Section 57 moral rights)
2. Unlimited liability / uncapped indemnity
3. Foreign governing law for India-India contracts
4. Missing mandatory clauses (data protection, stamp duty)
5. One-sided termination or auto-renewal traps
6. Medium-risk commercial terms

## Negotiation Tactics

### When You Have Legal Leverage
- Be confident: "This clause is void under Indian law."
- Cite the specific section and case law
- Offer a reasonable alternative that meets the counterparty's underlying concern

### When It's a Commercial Negotiation
- Frame as industry standard: "Market practice is 12-month liability cap."
- Offer concessions in exchange: "We'll accept your payment terms if you cap liability."
- Propose mutual obligations: "Both parties should have equal termination rights."

### Bundle Strategy
- Group related asks together
- Lead with a strong legal argument, then include commercial asks
- Be prepared to concede on lower-priority items

## Tools to Use

- `search_clause_patterns` — get suggested alternatives and talking points
- `check_enforceability` — confirm enforceability before making claims
- `get_required_clauses` — identify what's missing (use as leverage)
