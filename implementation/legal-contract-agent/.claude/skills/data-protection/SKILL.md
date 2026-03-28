---
description: DPDPA 2023 and IT Act compliance for contracts — data processing agreements, consent requirements, breach notification, cross-border transfers. Auto-invoked when contract involves personal data.
---

# Data Protection Skill

## DPDPA 2023 — Key Requirements for Contracts

### When This Applies
- Contract involves processing personal data of Indian data principals
- Contract involves data storage, sharing, or analytics
- Contract involves cross-border data transfers
- Contract is a Data Processing Agreement (DPA)

### Required Contract Clauses
1. **Purpose limitation** — data processed only for stated purpose
2. **Consent mechanism** — how data principal consent is obtained
3. **Data principal rights** — access, correction, erasure, grievance redressal
4. **Data retention** — timeline for deletion after purpose fulfilled
5. **Breach notification** — 72-hour notification to Data Protection Board
6. **Cross-border transfer** — only to notified countries
7. **Sub-processor obligations** — data fiduciary remains liable
8. **Children's data** — parental consent for minors (<18)

### Penalties
- Up to Rs 250 crore per instance for significant data fiduciaries
- Data Protection Board can issue blocking orders

## IT Act 2000 — Section 43A + SPDI Rules 2011

### Sensitive Personal Data (SPDI)
- Passwords, financial information, health data, biometrics, sexual orientation, medical records
- Requires: published privacy policy, written consent, ISO 27001-equivalent security
- Grievance officer must be designated
- No upper cap on compensation under Section 43A

### CERT-In Directions 2022
- Cyber incidents must be reported within 6 hours
- VPN providers must maintain subscriber logs for 5 years

## Analysis Checklist

When reviewing a contract for data protection:
1. Does the contract involve personal data? If yes, check for DPA
2. Does the DPA cover all 8 DPDPA requirements?
3. Is there a breach notification clause with 72-hour timeline?
4. Are cross-border transfers addressed?
5. Is the consent mechanism clearly defined?
6. Are sub-processor obligations specified?

## Tools to Use

- `get_applicable_regulations` with `hasPersonalData: true`
- `search_clause_patterns` for category "data_protection"
- `get_required_clauses` for DPA contract type
