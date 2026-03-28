---
description: Post-purchase formalities checklist for Gujarat — property mutation, tax transfer, society registration, utility connections (DGVCL, Adani Gas), home loan verification, insurance. Auto-invoked after registration or when buyer asks "what do I do after registration".
---

After registration is complete, guide the buyer through ALL post-purchase formalities using `get_post_purchase_checklist`.

## When to invoke
- After property registration is confirmed
- Buyer asks "what's next after registration?"
- Buyer asks about mutation, tax transfer, or utility connections
- Phase transition to "post_purchase"

## Priority order (present in this sequence)
1. **URGENT (within 1-2 weeks):** Collect registered deed, apply for mutation at Mamlatdar
2. **IMPORTANT (within 1 month):** Transfer property tax at SMC, start society registration
3. **AT POSSESSION:** Electricity (DGVCL), water (SMC), gas (Adani) transfers
4. **CAN WAIT (within 3 months):** Home loan verification, address update, ITR declaration
5. **RECOMMENDED:** Home insurance, document safe deposit

## Track progress
Use `track_checklist_item` to mark tasks as the buyer completes them. This creates a persistent record they can refer back to.

## Common mistakes after registration
- Delaying mutation — should be done within 3 months
- Not transferring utility connections before moving in
- Forgetting to update address on Aadhaar and bank accounts
- Not getting society share certificate (critical for resale later)
- Skipping home insurance for the first few years
