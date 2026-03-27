// Real Estate Transaction Agent — Main Orchestrator
// Analyzes Gujarat property transactions, verifies across multiple government portals,
// flags risks, calculates stamp duty, and generates due diligence dossiers.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { browserMcp } from "./mcp-servers/browser-mcp.js";
import { propertyKbMcp } from "./mcp-servers/property-kb-mcp.js";
import { trackerMcp } from "./mcp-servers/tracker-mcp.js";

const SYSTEM_PROMPT = `You are a Real Estate Transaction Agent specializing in Gujarat property verification.
You help first-time homebuyers navigate property purchases by performing comprehensive due diligence checks against multiple government portals and knowledge bases.

YOUR CAPABILITIES:
1. Verify RERA registration — search and validate projects on the GujRERA portal
2. Check litigation history — search eCourts for cases against seller/builder
3. Verify land records — search AnyRoR for ownership and encumbrance details
4. Verify document registration — search GARVI for registered sale deeds
5. Look up jantri rates — check GARVI for government ready reckoner rates
6. Check property tax status — verify SMC property tax payments
7. Verify builder GST registration — confirm builder's GSTIN on GST portal
8. Flag red flags — check property attributes against known risk patterns
9. Calculate stamp duty — Gujarat-specific rates with female buyer discounts
10. Look up jantri rates — government ready reckoner rates for Surat zones (knowledge base)
11. Generate document checklists — property-type-specific lists of required documents
12. Maintain an audit trail — every verification step is logged with portal, result, and status

PORTAL TOOLS AVAILABLE:
- search_rera_project — Search GujRERA for project registration
- get_rera_project_details — Get full RERA project details
- search_ecourts — Search eCourts for litigation by party name (may return captcha_required)
- search_anyror_land_record — Search AnyRoR for urban land records by survey details
- search_anyror_by_owner — Search AnyRoR by owner name
- search_garvi_document — Search GARVI for registered documents
- lookup_garvi_jantri — Look up jantri rates on GARVI
- check_smc_property_tax — Check SMC property tax status
- verify_gstin — Verify builder's GST registration
- take_portal_screenshot — Capture evidence from any portal URL

YOUR ANALYSIS PROCESS:
1. Create a purchase record via create_purchase to track this property
2. RERA VERIFICATION:
   a. Search RERA portal via search_rera_project using the RERA ID or project name
   b. Get detailed project info via get_rera_project_details using the RERA ID
   c. Log verification step via log_verification
3. LITIGATION CHECK:
   a. Search eCourts via search_ecourts for the seller/builder name
   b. If captcha_required is returned, note this limitation and suggest copilot mode fallback
   c. Log verification step
4. LAND RECORD VERIFICATION:
   a. Search AnyRoR via search_anyror_land_record using survey/TP details
   b. Also search via search_anyror_by_owner for the seller's name
   c. Log verification step
5. DOCUMENT REGISTRATION CHECK:
   a. If the buyer provides a document number, search GARVI via search_garvi_document
   b. Look up jantri rates via lookup_garvi_jantri for the property's survey
   c. Log verification step
6. PROPERTY TAX CHECK:
   a. If the buyer provides a property tax ID, check via check_smc_property_tax
   b. Log verification step
7. BUILDER GST VERIFICATION:
   a. If the buyer provides a GSTIN, verify via verify_gstin
   b. Log verification step
8. CROSS-PORTAL VERIFICATION:
   a. Compare seller/promoter names across all portals that returned results
   b. Flag any name mismatches — this could indicate fraud or title issues
   c. Compare property descriptions and survey numbers across AnyRoR and GARVI
9. KNOWLEDGE BASE CHECKS:
   a. Check red flags via check_red_flags based on all portal findings
   b. Calculate stamp duty via calculate_stamp_duty for the property type and value
   c. Look up jantri rate via get_jantri_rate for the relevant zone
   d. Get required documents via get_required_documents for the property type
10. Generate the comprehensive due diligence dossier

FALLBACK INSTRUCTIONS — CLAUDE BROWSER MCP:
If any portal tool returns captcha_required or portal_unavailable, DO NOT give up.
Instead, try using Claude Browser MCP (mcp__claude-in-chrome__*) tools as fallback:

1. First call mcp__claude-in-chrome__tabs_context_mcp to check if Chrome extension is connected
2. If connected:
   a. Create a new tab: mcp__claude-in-chrome__tabs_create_mcp with the portal URL
   b. Use mcp__claude-in-chrome__read_page to see the page content
   c. Use mcp__claude-in-chrome__form_input to fill search forms
   d. Use mcp__claude-in-chrome__computer to click buttons and solve CAPTCHAs visually
   e. Use mcp__claude-in-chrome__read_page again to extract results
   f. Take a screenshot for the dossier
3. If Chrome extension is NOT connected:
   - Note the limitation clearly in your report
   - Inform the user which portals could not be checked and why
   - Suggest: "Connect the Claude Browser Chrome extension to enable CAPTCHA-protected portal access"

IMPORTANT: Continue with other portal checks regardless — do NOT stop the entire analysis because one portal is unavailable. Mark unverified portals as "not_checked" in the dossier.

YOUR DUE DILIGENCE REPORT SHOULD INCLUDE:
1. Property Overview — address, type, builder, RERA ID
2. RERA Verification — registration status, expiry date, project status, complaints
3. Litigation Check — eCourts findings for seller/builder
4. Land Record Verification — AnyRoR ownership confirmation, encumbrance status
5. Document Registration — GARVI findings, jantri rate comparison
6. Property Tax Status — SMC tax payment status
7. Builder Verification — GST registration status
8. Cross-Portal Consistency — were names and details consistent across portals?
9. Red Flag Assessment — triggered flags with severity and recommended actions
10. Financial Analysis — stamp duty breakdown, jantri rate comparison, budget assessment
11. Document Checklist — what the buyer needs to collect
12. Overall Risk Rating — CLEAR / REVIEW / CAUTION / STOP
13. Recommended Next Steps — prioritized action items for the buyer
14. Disclaimer

CRITICAL RULES:
- NEVER provide definitive legal or investment advice. Always frame as "verification findings" not "advice".
- NEVER say "you should buy this" or "this is a good investment".
- ALWAYS include at the end: "This verification report is AI-assisted and does not substitute for professional due diligence by a property lawyer and chartered surveyor."
- Be DIRECT about critical red flags — "This property is NOT registered with RERA. Do NOT proceed."
- Be TRANSPARENT when portal data is unavailable — say so, don't guess.
- Use PLAIN LANGUAGE — the buyer is not a legal expert. Explain terms like "encumbrance", "NA conversion", "jantri rate".

ANTI-HALLUCINATION RULES:
- ONLY cite information that comes from tool results. If a tool call fails or returns no data, say "Could not verify — portal did not return data" instead of making up results.
- If you cannot find RERA registration via the portal, do NOT assume the project is registered or unregistered — say "RERA verification inconclusive. Manual check recommended at gujrera.gujarat.gov.in."
- Every fact in your report (RERA status, complaints count, expiry date) must be traceable to a specific tool call result.
- If the buyer asks about something outside your verification scope (loan eligibility, vastu, resale value), say "This is outside my verification scope. Consult a [relevant professional]."
- When uncertain about any finding, say "I don't know" or "Could not determine" rather than guessing. It is better to be honest about gaps than to fabricate certainty.

CROSS-PORTAL VERIFICATION LOGIC:
- After completing all portal checks, compare the seller/promoter name found on RERA with the owner name on AnyRoR and the party name on eCourts.
- If names differ significantly (beyond minor spelling variations), flag it as a HIGH severity red flag.
- Compare the survey number from AnyRoR with the one used in GARVI jantri lookup — they should match.
- If the RERA-registered promoter is different from the land record owner, this could indicate an unauthorized transfer or title issue.

COMMUNICATION STYLE:
- Write for a first-time homebuyer who may not understand legal jargon
- Use bullet points and clear headers
- When explaining a red flag, include: what it means, why it matters, and what to do about it
- Include INR amounts formatted with commas (e.g., Rs 35,00,000)`;

export interface AnalyzePropertyOptions {
  reraId?: string;
  address: string;
  builderName?: string;
  propertyType: string;
  budget: number;
  state: string;
  sellerName?: string;
  district?: string;
  taluka?: string;
  village?: string;
  surveyNo?: string;
  documentNo?: string;
  documentYear?: string;
  sro?: string;
  propertyTaxId?: string;
  gstin?: string;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  type: "init" | "tool_call" | "tool_result" | "thinking" | "streaming" | "done";
  message: string;
  detail?: string;
  timestamp: string;
  turnNumber?: number;
  cost?: number;
  duration?: number;
}

export async function analyzeProperty(options: AnalyzePropertyOptions): Promise<string> {
  const prompt = `Perform comprehensive due diligence on this property:
- Address: ${options.address}
${options.reraId ? `- RERA ID: ${options.reraId}` : "- RERA ID: not provided (search by project/builder name)"}
${options.builderName ? `- Builder: ${options.builderName}` : "- Builder: not provided"}
- Property type: ${options.propertyType}
- Budget: Rs ${options.budget.toLocaleString("en-IN")}
- State: ${options.state}
${options.sellerName ? `- Seller/Promoter Name: ${options.sellerName}` : ""}
${options.district ? `- District: ${options.district}` : ""}
${options.taluka ? `- Taluka: ${options.taluka}` : ""}
${options.village ? `- Village: ${options.village}` : ""}
${options.surveyNo ? `- Survey/TP No: ${options.surveyNo}` : ""}
${options.documentNo ? `- Document No: ${options.documentNo}` : ""}
${options.documentYear ? `- Document Year: ${options.documentYear}` : ""}
${options.sro ? `- Sub-Registrar Office: ${options.sro}` : ""}
${options.propertyTaxId ? `- Property Tax ID: ${options.propertyTaxId}` : ""}
${options.gstin ? `- Builder GSTIN: ${options.gstin}` : ""}

Steps:
1. Use create_purchase to register this property for tracking
2. RERA: Use search_rera_project to find the project${options.reraId ? ` (RERA ID: ${options.reraId})` : options.builderName ? ` (builder: ${options.builderName})` : ""}
3. RERA: If found, use get_rera_project_details for full information
4. Log each verification step using log_verification
${options.sellerName || options.builderName ? `5. eCourts: Use search_ecourts to check litigation for "${options.sellerName || options.builderName}" in state="${options.state}", district="${options.district || "Surat"}"` : "5. eCourts: Skip if no seller/builder name available (note in report)"}
${options.surveyNo && options.district && options.taluka && options.village ? `6. AnyRoR: Use search_anyror_land_record with district="${options.district}", taluka="${options.taluka}", village="${options.village}", survey_no="${options.surveyNo}"` : "6. AnyRoR: Skip if survey details not provided (note in report)"}
${options.sellerName && options.district ? `7. AnyRoR: Use search_anyror_by_owner for owner_name="${options.sellerName}", district="${options.district}"` : "7. AnyRoR owner search: Skip if seller name/district not provided"}
${options.documentNo && options.documentYear && options.sro ? `8. GARVI: Use search_garvi_document for document_no="${options.documentNo}", year="${options.documentYear}", sro="${options.sro}"` : "8. GARVI document: Skip if document details not provided"}
${options.surveyNo && options.district && options.taluka && options.village ? `9. GARVI Jantri: Use lookup_garvi_jantri with district="${options.district}", taluka="${options.taluka}", village="${options.village}", survey_no="${options.surveyNo}"` : "9. GARVI jantri: Skip if survey details not provided"}
${options.propertyTaxId ? `10. SMC: Use check_smc_property_tax for property_id="${options.propertyTaxId}"` : "10. SMC tax: Skip if property tax ID not provided"}
${options.gstin ? `11. GSTN: Use verify_gstin for gstin="${options.gstin}"` : "11. GSTN: Skip if GSTIN not provided"}
12. Cross-portal verification: Compare names and details across all portal results
13. Use check_red_flags based on all portal findings
14. Use calculate_stamp_duty for property_type="${options.propertyType}", property_value=${options.budget}
15. Use get_jantri_rate for the property zone
16. Use get_required_documents for property_type="${options.propertyType}"
17. Generate the comprehensive due diligence dossier report`;

  const emit = options.onProgress ?? (() => {});
  const ts = () => new Date().toISOString();

  let result = "";
  let turnCount = 0;

  emit({ type: "init", message: "Starting comprehensive property due diligence...", timestamp: ts() });

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        "browser-mcp": browserMcp,
        "property-kb-mcp": propertyKbMcp,
        "tracker-mcp": trackerMcp,
      },
      model: "sonnet",
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 50,
    },
  })) {
    // System init message
    if ("type" in message && message.type === "system" && "subtype" in message && message.subtype === "init") {
      emit({ type: "init", message: "Agent initialized, connected to MCP servers", timestamp: ts() });
    }

    // Assistant message — contains tool_use blocks and text
    if ("type" in message && message.type === "assistant" && "message" in message) {
      const assistantMsg = message as { type: "assistant"; message: { content: Array<{ type: string; name?: string; input?: Record<string, unknown>; text?: string }> } };
      const content = assistantMsg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            turnCount++;
            const toolName = block.name;
            const toolDisplayNames: Record<string, string> = {
              // Existing RERA tools
              "mcp__browser-mcp__search_rera_project": "Searching GujRERA portal",
              "mcp__browser-mcp__get_rera_project_details": "Fetching RERA project details",
              "mcp__browser-mcp__take_portal_screenshot": "Taking portal screenshot",
              // New portal tools
              "mcp__browser-mcp__search_ecourts": "Searching eCourts for litigation",
              "mcp__browser-mcp__search_anyror_land_record": "Searching AnyRoR land records",
              "mcp__browser-mcp__search_anyror_by_owner": "Searching AnyRoR by owner name",
              "mcp__browser-mcp__search_garvi_document": "Searching GARVI for registered documents",
              "mcp__browser-mcp__lookup_garvi_jantri": "Looking up jantri rates on GARVI",
              "mcp__browser-mcp__check_smc_property_tax": "Checking SMC property tax status",
              "mcp__browser-mcp__verify_gstin": "Verifying builder GST registration",
              // Knowledge base tools
              "mcp__property-kb-mcp__get_jantri_rate": "Looking up jantri rate",
              "mcp__property-kb-mcp__calculate_stamp_duty": "Calculating stamp duty",
              "mcp__property-kb-mcp__check_red_flags": "Checking red flag patterns",
              "mcp__property-kb-mcp__get_required_documents": "Getting document checklist",
              // Tracker tools
              "mcp__tracker-mcp__create_purchase": "Registering purchase for tracking",
              "mcp__tracker-mcp__log_verification": "Logging verification step",
              "mcp__tracker-mcp__get_verification_log": "Loading verification log",
              "mcp__tracker-mcp__update_phase": "Updating purchase phase",
              "mcp__tracker-mcp__get_purchase_summary": "Getting purchase summary",
            };
            const displayName = toolDisplayNames[toolName] ?? `Calling tool: ${toolName.replace(/mcp__[^_]+__/, "")}`;

            const detail = block.input
              ? Object.entries(block.input)
                  .filter(([k]) => !["text", "result", "notes"].includes(k))
                  .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 50) : v}`)
                  .join(", ")
              : undefined;

            emit({
              type: "tool_call",
              message: displayName,
              detail: detail || undefined,
              timestamp: ts(),
              turnNumber: turnCount,
            });
          }

          if (block.type === "text" && block.text && !("result" in message)) {
            const preview = block.text.slice(0, 100).replace(/\n/g, " ");
            if (preview.length > 20) {
              emit({
                type: "streaming",
                message: preview + (block.text.length > 100 ? "..." : ""),
                timestamp: ts(),
              });
            }
          }
        }
      }
    }

    // Final result
    if ("type" in message && message.type === "result") {
      const resultMsg = message as {
        type: "result";
        subtype: string;
        result?: string;
        num_turns?: number;
        total_cost_usd?: number;
        duration_ms?: number;
      };

      if (resultMsg.subtype === "success" && resultMsg.result) {
        result = resultMsg.result;
        emit({
          type: "done",
          message: "Comprehensive due diligence complete",
          timestamp: ts(),
          turnNumber: resultMsg.num_turns,
          cost: resultMsg.total_cost_usd,
          duration: resultMsg.duration_ms,
        });
      } else {
        emit({
          type: "done",
          message: `Analysis ended: ${resultMsg.subtype}`,
          timestamp: ts(),
          turnNumber: resultMsg.num_turns,
          cost: resultMsg.total_cost_usd,
          duration: resultMsg.duration_ms,
        });
      }
    }
  }

  return result;
}
