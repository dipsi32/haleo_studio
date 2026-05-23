import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// San Jose CKAN API - Active Building Permits
const SJ_ACTIVE_PERMITS_RESOURCE = "761b7ae8-3be1-4ad6-923d-c7af6404a904";
const SJ_API_BASE = "https://data.sanjoseca.gov/api/3/action/datastore_search";

interface ExtractedData {
  contractor_name: string;
  license_number: string;
  project_address: string;
  project_scope: string;
  contract_value: string;
  payment_schedule: string;
  timeline: string;
  change_order_policy: string;
  warranty_terms: string;
  dispute_resolution: string;
  start_date: string;
  end_date: string;
  deposit_percentage: string;
  materials_specified: boolean;
  permits_mentioned: boolean;
}

interface RedFlag {
  severity: "critical" | "warning" | "notice";
  category: string;
  title: string;
  detail: string;
  evidence: string;
  whatToDo: string;
  source: string;
}

interface Insight {
  type: "positive" | "neutral" | "context";
  category: string;
  title: string;
  detail: string;
  source: string;
}

interface HaleoTip {
  id: string;
  trigger: string;
  headline: string;
  body: string;
  derivedFrom: string[];
  placement: string;
}

// ─── LLM Extraction ───────────────────────────────────────────────
async function extractProposalData(
  fileBase64: string,
  fileName: string,
  apiKey: string,
): Promise<ExtractedData> {
  console.log("Extracting proposal data via LLM...");

  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);

  const systemPrompt = `You are an expert construction contract analyst. You will be given a contractor proposal document. Your job is to extract EVERY financial detail, clause, and specification with absolute precision.

CRITICAL INSTRUCTIONS:
- For contract_value: Find the TOTAL contract price / total amount / grand total. Look for the largest dollar amount that represents the full project cost. Do NOT confuse line-item amounts, deposits, or partial payments with the total.
- For deposit_percentage: Calculate as a percentage of the total contract value if given as a dollar amount.
- For payment_schedule: List ALL payment milestones with their amounts or percentages.
- For project_scope: Provide a comprehensive summary of ALL work items listed.
- For project_address: Extract the project/job site address where work will be performed.
- Read the ENTIRE document carefully. The total price is often near the end or in a summary section.`;

  const userContent: any[] = [
    { type: "text", text: `Analyze this contractor proposal document (${fileName}) and extract all contract details with absolute precision. Pay special attention to the TOTAL contract value — it is the grand total for the entire project, not a line item or deposit.` },
  ];

  if (isImage) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${fileBase64}` },
    });
  } else if (isPdf) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:application/pdf;base64,${fileBase64}` },
    });
  } else {
    try {
      const decoded = atob(fileBase64);
      userContent.push({ type: "text", text: `\n\nDocument content:\n${decoded.substring(0, 50000)}` });
    } catch {
      userContent.push({ type: "text", text: `\n\nBase64 document content:\n${fileBase64.substring(0, 50000)}` });
    }
  }

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "extract_proposal_data",
        description: "Extract all key fields from a contractor proposal document",
        parameters: {
          type: "object",
          properties: {
            contractor_name: { type: "string", description: "Full business name of the contractor" },
            license_number: { type: "string", description: "Contractor license number (e.g. CSLB #123456, B-123456). Use 'Not specified' if not found." },
            project_address: { type: "string", description: "The project/job site address where work will be performed. Use 'Not specified' if not found." },
            project_scope: { type: "string", description: "Comprehensive description of ALL work items in the scope of work" },
            contract_value: { type: "string", description: "The TOTAL contract price / grand total for the entire project (e.g. '$213,350.00'). This is the largest amount representing the full cost." },
            payment_schedule: { type: "string", description: "All payment milestones, amounts, and terms. Include percentages and dollar amounts." },
            timeline: { type: "string", description: "Project timeline or estimated duration" },
            change_order_policy: { type: "string", description: "How changes to scope/price are handled. Use 'Not specified' if not found." },
            warranty_terms: { type: "string", description: "Warranty information and terms. Use 'Not specified' if not found." },
            dispute_resolution: { type: "string", description: "Arbitration, mediation, or dispute resolution terms. Use 'Not specified' if not found." },
            start_date: { type: "string", description: "Project start date. Use 'Not specified' if not found." },
            end_date: { type: "string", description: "Project end/completion date. Use 'Not specified' if not found." },
            deposit_percentage: { type: "string", description: "Upfront deposit as a percentage. If given as dollar amount, calculate the percentage of total." },
            materials_specified: { type: "boolean", description: "Whether specific materials, brands, or models are listed" },
            permits_mentioned: { type: "boolean", description: "Whether building permits are mentioned in the proposal" },
          },
          required: ["contractor_name", "license_number", "project_address", "project_scope", "contract_value", "payment_schedule", "timeline", "change_order_policy", "warranty_terms", "dispute_resolution", "start_date", "end_date", "deposit_percentage", "materials_specified", "permits_mentioned"],
          additionalProperties: false,
        },
      },
    },
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "extract_proposal_data" } },
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("LLM extraction failed:", err);
    throw new Error(`LLM extraction failed: ${response.status}`);
  }

  const data = await response.json();

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      console.log("Tool call extraction successful");
      return parsed;
    } catch (e) {
      console.error("Failed to parse tool call arguments:", e);
    }
  }

  const content = data.choices?.[0]?.message?.content || "";
  console.log("Falling back to content parsing. Content:", content.substring(0, 500));
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const jsonStr = jsonMatch[1]?.trim() || content.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse LLM response:", content);
    return {
      contractor_name: "Unknown",
      license_number: "Not specified",
      project_address: "Not specified",
      project_scope: "Not specified",
      contract_value: "Not specified",
      payment_schedule: "Not specified",
      timeline: "Not specified",
      change_order_policy: "Not specified",
      warranty_terms: "Not specified",
      dispute_resolution: "Not specified",
      start_date: "Not specified",
      end_date: "Not specified",
      deposit_percentage: "Not specified",
      materials_specified: false,
      permits_mentioned: false,
    };
  }
}

// ─── San Jose Permit Intelligence ──────────────────────────────────
async function fetchSanJosePermits(contractorName: string) {
  console.log(`Fetching San Jose permits for: ${contractorName}`);

  const searchTerms = contractorName.replace(/[^a-zA-Z0-9 ]/g, "").trim();

  const url = `${SJ_API_BASE}?resource_id=${SJ_ACTIVE_PERMITS_RESOURCE}&q=${encodeURIComponent(searchTerms)}&limit=100`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`San Jose API returned ${response.status}`);
      return { permits: [], stats: null, error: `API returned ${response.status}` };
    }

    const data = await response.json();
    const records = data.result?.records || [];

    console.log(`Found ${records.length} permit records`);

    const matchedRecords = records.filter((r: any) => {
      const contractor = (r.CONTRACTOR || "").toLowerCase();
      const searchLower = searchTerms.toLowerCase();
      const words = searchLower.split(/\s+/);
      return (
        contractor.includes(searchLower) ||
        words.filter((w: string) => w.length > 2 && contractor.includes(w)).length >= 2
      );
    });

    console.log(`Matched ${matchedRecords.length} records to contractor`);

    const permits = matchedRecords.map((r: any) => ({
      permit_number: r.FOLDERNUMBER || "N/A",
      description: r.FOLDERDESC || r.WORKDESCRIPTION || "N/A",
      type: r.SUBTYPEDESCRIPTION || r.FOLDERNAME || "N/A",
      address: `${r.ADDRESS || ""}, San Jose, CA`,
      issue_date: r.ISSUEDATE || null,
      final_date: r.FINALDATE || null,
      status: r.FINALDATE ? "Finaled" : "Active",
      valuation: r.PERMITVALUATION || null,
      work_description: r.WORKDESCRIPTION || "N/A",
    }));

    const totalPermits = permits.length;
    const finaledPermits = permits.filter((p: any) => p.status === "Finaled").length;
    const finaledPercentage = totalPermits > 0 ? Math.round((finaledPermits / totalPermits) * 100) : 0;

    const durations: number[] = [];
    for (const p of permits) {
      if (p.issue_date && p.final_date) {
        const issued = new Date(p.issue_date);
        const finaled = new Date(p.final_date);
        const weeks = (finaled.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24 * 7);
        if (weeks > 0 && weeks < 200) durations.push(weeks);
      }
    }
    const avgDurationWeeks =
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null;

    const typeBreakdown: Record<string, number> = {};
    for (const p of permits) {
      const type = p.type || "Other";
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    }

    const yearBreakdown: Record<string, number> = {};
    for (const p of permits) {
      if (p.issue_date) {
        const year = new Date(p.issue_date).getFullYear().toString();
        yearBreakdown[year] = (yearBreakdown[year] || 0) + 1;
      }
    }

    const valuations = permits
      .map((p: any) => parseFloat((p.valuation || "0").toString().replace(/[^0-9.]/g, "")))
      .filter((v: number) => v > 0);
    const totalValuation = valuations.reduce((a: number, b: number) => a + b, 0);
    const avgValuation = valuations.length > 0 ? Math.round(totalValuation / valuations.length) : 0;

    const activePermits = totalPermits - finaledPermits;

    // Calculate years active
    const dates = permits.map((p: any) => p.issue_date ? new Date(p.issue_date) : null).filter(Boolean);
    const oldest = dates.length > 0 ? Math.min(...dates.map((d: any) => d.getTime())) : null;
    const yearsActive = oldest ? Math.round((Date.now() - oldest) / (1000 * 60 * 60 * 24 * 365)) : null;

    const stats = {
      total_permits: totalPermits,
      finaled_permits: finaledPermits,
      finaled_percentage: finaledPercentage,
      active_permits: activePermits,
      avg_duration_weeks: avgDurationWeeks,
      type_breakdown: typeBreakdown,
      year_breakdown: yearBreakdown,
      total_valuation: totalValuation,
      avg_valuation: avgValuation,
      years_active: yearsActive,
      city: "San Jose, CA",
      data_source: "City of San Jose Open Data Portal",
      last_updated: new Date().toISOString(),
    };

    return { permits, stats, error: null };
  } catch (error) {
    console.error("Error fetching San Jose permits:", error);
    return { permits: [], stats: null, error: String(error) };
  }
}

// ─── San Jose Permit Lookup by Address ─────────────────────────────
async function fetchPermitsByAddress(address: string) {
  console.log(`Fetching permits for address: ${address}`);
  const normalized = address
    .toUpperCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const url = `${SJ_API_BASE}?resource_id=${SJ_ACTIVE_PERMITS_RESOURCE}&q=${encodeURIComponent(normalized)}&limit=20`;

  try {
    const response = await fetch(url);
    if (!response.ok) return { permits: [], error: `API returned ${response.status}` };

    const data = await response.json();
    const records = data.result?.records || [];

    // Filter to records where ADDRESS closely matches
    const matched = records.filter((r: any) => {
      const addr = (r.ADDRESS || "").toUpperCase();
      // Match on street number + street name
      const parts = normalized.split(/\s+/);
      const streetNum = parts[0];
      return addr.includes(streetNum) && parts.slice(1, 3).some((p: string) => p.length > 2 && addr.includes(p));
    });

    const permits = matched.map((r: any) => ({
      permit_number: r.FOLDERNUMBER || "N/A",
      description: r.FOLDERDESC || r.WORKDESCRIPTION || "N/A",
      type: r.SUBTYPEDESCRIPTION || r.FOLDERNAME || "N/A",
      address: `${r.ADDRESS || ""}, San Jose, CA`,
      issue_date: r.ISSUEDATE || null,
      final_date: r.FINALDATE || null,
      status: r.FINALDATE ? "Finaled" : "Active",
      valuation: r.PERMITVALUATION || null,
      contractor: r.CONTRACTOR || null,
    }));

    return { permits, error: null };
  } catch (error) {
    console.error("Address permit lookup error:", error);
    return { permits: [], error: String(error) };
  }
}

// ─── CSLB License Verification ─────────────────────────────────────
async function verifyCSLBLicense(licenseNumber: string) {
  console.log(`Verifying CSLB license: ${licenseNumber}`);

  const cleanNumber = licenseNumber.replace(/[^0-9]/g, "");

  if (!cleanNumber || cleanNumber.length < 4) {
    return {
      verified: false,
      status: "invalid_number",
      message: "License number could not be parsed",
      lookup_url: null,
    };
  }

  const lookupUrl = `https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx`;

  try {
    const detailUrl = `https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${cleanNumber}`;

    const response = await fetch(detailUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClearBuild/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      return {
        verified: false,
        status: "lookup_failed",
        license_number: cleanNumber,
        message: `CSLB lookup returned ${response.status}. You can verify manually.`,
        lookup_url: lookupUrl,
        detail_url: detailUrl,
        data_source: "California Contractors State License Board (CSLB)",
      };
    }

    const html = await response.text();

    const extractField = (label: string): string => {
      const patterns = [
        new RegExp(`${label}[:\\s]*</(?:span|td|th)>\\s*<(?:span|td)[^>]*>\\s*([^<]+)`, "i"),
        new RegExp(`${label}[^<]*<[^>]+>([^<]+)`, "i"),
        new RegExp(`>${label}<[^>]+>[^<]*<[^>]+>([^<]+)`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]?.trim()) return match[1].trim();
      }
      return "";
    };

    const businessName = extractField("Business Name") || extractField("BusinessName");
    const status = extractField("Status") || extractField("License Status");
    const classification = extractField("Classification") || extractField("License Classification");
    const issueDate = extractField("Issue Date") || extractField("Original Issue Date");
    const expireDate = extractField("Expir") || extractField("Expire Date");
    const bondInfo = extractField("Bond") || extractField("Contractor Bond");
    const workerComp = extractField("Workers.?Comp") || extractField("Workers Compensation");
    const address = extractField("Address") || extractField("Business Address");

    const hasData = businessName || status;
    const isActive = status?.toLowerCase().includes("active");

    // Check for complaints
    const complaintMatch = html.match(/complaint[s]?\s*[:\s]*(\d+)/i);
    const complaintCount = complaintMatch ? parseInt(complaintMatch[1]) : 0;

    // Check for disciplinary actions
    const hasDisciplinary = /disciplin/i.test(html) && !/no.*disciplin/i.test(html);

    return {
      verified: hasData,
      license_number: cleanNumber,
      business_name: businessName || null,
      status: status || "Unable to determine",
      is_active: isActive,
      classification: classification || null,
      issue_date: issueDate || null,
      expire_date: expireDate || null,
      bond_info: bondInfo || null,
      workers_comp: workerComp || null,
      address: address || null,
      complaint_count: complaintCount,
      has_disciplinary: hasDisciplinary,
      lookup_url: lookupUrl,
      detail_url: detailUrl,
      data_source: "California Contractors State License Board (CSLB)",
    };
  } catch (error) {
    console.error("CSLB lookup error:", error);
    return {
      verified: false,
      status: "error",
      license_number: cleanNumber,
      message: `We couldn't automatically verify this license. You can check it yourself at CSLB.`,
      lookup_url: lookupUrl,
      detail_url: `https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${cleanNumber}`,
      data_source: "California Contractors State License Board (CSLB)",
    };
  }
}

// ─── Red Flag Detection ────────────────────────────────────────────
function identifyRedFlags(
  extracted: ExtractedData,
  licenseData: any,
  permitStats: any,
): RedFlag[] {
  const flags: RedFlag[] = [];

  // LICENSE FLAGS
  if (!extracted.license_number || extracted.license_number === "Not specified") {
    flags.push({
      severity: "critical",
      category: "License",
      title: "No license number in proposal",
      detail: "California law (Business & Professions Code §7030) requires contractors to include their license number on all contracts and proposals for work over $500.",
      evidence: "We searched the full proposal text and could not find a 7-digit California contractor license number.",
      whatToDo: "Ask the contractor for their license number before signing anything. If they can't or won't provide one, walk away.",
      source: "Proposal text analysis",
    });
  }

  if (licenseData?.verified && licenseData.status && !licenseData.is_active) {
    const statusText = licenseData.status;
    flags.push({
      severity: "critical",
      category: "License",
      title: `License is ${statusText}`,
      detail: "Working with an unlicensed or lapsed contractor means you have no recourse through the CSLB if something goes wrong, and the work may not pass inspection.",
      evidence: `CSLB shows license #${licenseData.license_number} status: ${statusText}${licenseData.expire_date ? `. Expired: ${licenseData.expire_date}` : ""}.`,
      whatToDo: statusText?.toLowerCase().includes("expired")
        ? "Ask the contractor to renew their license before you sign. Renewal is straightforward if they're in good standing."
        : "Do not proceed with this contractor. A suspended or revoked license indicates serious issues.",
      source: "California State License Board (CSLB)",
    });
  }

  if (licenseData?.complaint_count > 0) {
    const sev = licenseData.complaint_count >= 3 ? "warning" : "notice";
    flags.push({
      severity: sev,
      category: "License",
      title: `${licenseData.complaint_count} complaint${licenseData.complaint_count > 1 ? "s" : ""} on file with CSLB`,
      detail: "Complaints can range from minor billing disputes to significant quality issues. The count alone doesn't tell the full story, but multiple complaints warrant investigation.",
      evidence: `CSLB records show ${licenseData.complaint_count} formal complaint(s) for license #${licenseData.license_number}.`,
      whatToDo: "Check the CSLB website for complaint details. Ask the contractor about them — a good contractor will explain openly.",
      source: "California State License Board (CSLB)",
    });
  }

  if (licenseData?.verified && (!licenseData.workers_comp || /exempt|none/i.test(licenseData.workers_comp || ""))) {
    flags.push({
      severity: "warning",
      category: "Insurance",
      title: "Workers' comp coverage unclear",
      detail: "If a worker is injured on your property and the contractor lacks workers' compensation insurance, you could be held liable.",
      evidence: `CSLB shows workers' comp status: ${licenseData.workers_comp || "Not listed"}.`,
      whatToDo: "Request a Certificate of Insurance showing current workers' comp and general liability coverage before work begins.",
      source: "California State License Board (CSLB)",
    });
  }

  // PAYMENT FLAGS
  const depositStr = extracted.deposit_percentage || "";
  const depositNum = parseFloat(depositStr.replace(/[^0-9.]/g, ""));
  if (depositNum > 10) {
    const contractVal = parseFloat((extracted.contract_value || "0").replace(/[^0-9.]/g, ""));
    const legalMax = contractVal > 0 ? Math.min(contractVal * 0.1, 1000) : 1000;
    flags.push({
      severity: depositNum > 33 ? "critical" : "warning",
      category: "Payment",
      title: `${depositNum}% due at signing`,
      detail: `California law limits down payments to 10% of the contract price or $1,000, whichever is less, for home improvement contracts. A ${depositNum}% upfront payment exceeds this limit.`,
      evidence: `Proposal states ${depositNum}% deposit at signing. Legal maximum: $${legalMax.toLocaleString()}.`,
      whatToDo: "Request a revised payment schedule. A fair structure ties payments to completed milestones: 10% at signing, progress payments at verifiable stages, and 10-15% held until final walkthrough.",
      source: "CA Business & Professions Code §7159",
    });
  }

  // CHANGE ORDER FLAGS
  if (!extracted.change_order_policy || extracted.change_order_policy === "Not specified") {
    flags.push({
      severity: "warning",
      category: "Scope",
      title: "No change order process defined",
      detail: "Without a written change order process, you have no protection against unexpected price increases. Change orders are the #1 source of budget overruns in remodeling.",
      evidence: "No written change order clause found in the proposal.",
      whatToDo: "Ask contractor to add a clause: all changes must be documented in writing with revised price and timeline before work begins.",
      source: "Proposal text analysis",
    });
  }

  // TIMELINE FLAGS
  if (!extracted.end_date || extracted.end_date === "Not specified") {
    flags.push({
      severity: "warning",
      category: "Timeline",
      title: "No completion date specified",
      detail: "Without a clear end date, there's no accountability for delays. Projects without deadlines tend to drag indefinitely.",
      evidence: "No end date or substantial completion date found in the proposal.",
      whatToDo: "Add a specific completion date or 'substantial completion' date with reasonable daily penalties for delays beyond it.",
      source: "Proposal text analysis",
    });
  }

  // TIMELINE vs PERMIT HISTORY
  if (permitStats && permitStats.avg_duration_weeks && extracted.timeline && extracted.timeline !== "Not specified") {
    const proposedWeeks = parseTimelineToWeeks(extracted.timeline);
    if (proposedWeeks && permitStats.avg_duration_weeks > proposedWeeks * 1.3) {
      flags.push({
        severity: "warning",
        category: "Timeline",
        title: "Proposed timeline may be optimistic",
        detail: `This contractor's recent projects in San Jose took an average of ${permitStats.avg_duration_weeks} weeks, but this proposal estimates ${proposedWeeks} weeks. Remodeling timelines almost always run long.`,
        evidence: `Based on ${permitStats.total_permits} San Jose permits. Average: ${permitStats.avg_duration_weeks} weeks. Proposed: ${proposedWeeks} weeks.`,
        whatToDo: `Plan your life around a ${permitStats.avg_duration_weeks}-week timeline rather than the proposed ${proposedWeeks} weeks.`,
        source: "San Jose Building Permit Records",
      });
    }
  }

  // WARRANTY FLAGS
  if (!extracted.warranty_terms || extracted.warranty_terms === "Not specified") {
    flags.push({
      severity: "notice",
      category: "Warranty",
      title: "No warranty terms specified",
      detail: "Without written warranty terms, you may have limited recourse if workmanship issues appear after the project is complete.",
      evidence: "No warranty clause found in the proposal.",
      whatToDo: "Ask for minimum 1-year workmanship warranty and pass-through manufacturer warranties on all materials.",
      source: "Proposal text analysis",
    });
  }

  return flags;
}

function parseTimelineToWeeks(timeline: string): number | null {
  const weekMatch = timeline.match(/(\d+)\s*week/i);
  if (weekMatch) return parseInt(weekMatch[1]);
  const monthMatch = timeline.match(/(\d+)\s*month/i);
  if (monthMatch) return parseInt(monthMatch[1]) * 4.3;
  const dayMatch = timeline.match(/(\d+)\s*day/i);
  if (dayMatch) return Math.round(parseInt(dayMatch[1]) / 7);
  return null;
}

// ─── Positive Signals ──────────────────────────────────────────────
function generateInsights(
  extracted: ExtractedData,
  licenseData: any,
  permitStats: any,
): Insight[] {
  const insights: Insight[] = [];

  if (licenseData?.is_active && (licenseData.complaint_count || 0) === 0) {
    insights.push({
      type: "positive",
      category: "License",
      title: "Clean license — active with zero complaints",
      detail: `License #${licenseData.license_number} is active${licenseData.issue_date ? ` since ${licenseData.issue_date}` : ""} with no complaints on file. This is a good sign.`,
      source: "CSLB",
    });
  }

  if (permitStats && permitStats.total_permits >= 5) {
    insights.push({
      type: "positive",
      category: "Experience",
      title: `${permitStats.total_permits} permits in San Jose${permitStats.years_active ? ` over ${permitStats.years_active} years` : ""}`,
      detail: "This contractor has a substantial local track record. They know the San Jose permitting process and local building requirements.",
      source: "San Jose Permit Records",
    });
  }

  if (permitStats && permitStats.finaled_percentage >= 80) {
    insights.push({
      type: "positive",
      category: "Completion",
      title: `${permitStats.finaled_percentage}% project completion rate`,
      detail: `Of ${permitStats.total_permits} permits filed, ${permitStats.finaled_percentage}% have been finaled (completed and signed off by inspectors). This indicates the contractor follows through.`,
      source: "San Jose Permit Records",
    });
  }

  if (licenseData?.classification) {
    insights.push({
      type: "context",
      category: "Specialization",
      title: `Licensed for: ${licenseData.classification}`,
      detail: "Make sure the classifications match your project needs. A kitchen remodel typically requires a B (General) license.",
      source: "CSLB",
    });
  }

  if (extracted.materials_specified) {
    insights.push({
      type: "positive",
      category: "Scope",
      title: "Materials and specs are detailed",
      detail: "The proposal includes specific materials, brands, or models. This reduces ambiguity about what you're getting.",
      source: "Proposal text analysis",
    });
  }

  if (extracted.permits_mentioned) {
    insights.push({
      type: "positive",
      category: "Process",
      title: "Permits are addressed in the proposal",
      detail: "The contractor mentions building permits, which suggests they plan to pull proper permits for the work.",
      source: "Proposal text analysis",
    });
  }

  return insights;
}

// ─── Haleo Contextual Tips ─────────────────────────────────────────
function generateHaleoTips(
  extracted: ExtractedData,
  licenseData: any,
  permitStats: any,
): HaleoTip[] {
  const tips: HaleoTip[] = [];

  // Timeline reality check
  if (permitStats?.avg_duration_weeks && extracted.timeline && extracted.timeline !== "Not specified") {
    const proposedWeeks = parseTimelineToWeeks(extracted.timeline);
    if (proposedWeeks && permitStats.avg_duration_weeks > proposedWeeks) {
      const extraWeeks = Math.round(permitStats.avg_duration_weeks - proposedWeeks);
      tips.push({
        id: "timeline-reality",
        trigger: "contractor_history",
        headline: "Plan for a longer timeline",
        body: `Your contractor estimates ${proposedWeeks} weeks, but their last ${permitStats.total_permits} San Jose projects averaged ${permitStats.avg_duration_weeks} weeks. That's ${extraWeeks} extra weeks. If you're planning to eat out or stay somewhere else, budget for ${Math.round(permitStats.avg_duration_weeks)} weeks, not ${proposedWeeks}.`,
        derivedFrom: ["Proposal timeline", "San Jose permit records"],
        placement: "permit_history_section",
      });
    }
  }

  // Down payment vs CA law
  const depositNum = parseFloat((extracted.deposit_percentage || "0").replace(/[^0-9.]/g, ""));
  const contractVal = parseFloat((extracted.contract_value || "0").replace(/[^0-9.]/g, ""));
  if (depositNum > 10 && contractVal > 0) {
    const legalMax = Math.min(contractVal * 0.1, 1000);
    tips.push({
      id: "downpayment-law",
      trigger: "payment_analysis",
      headline: `California caps this at $${legalMax.toLocaleString()}`,
      body: `This proposal asks for ${depositNum}% ($${Math.round(contractVal * depositNum / 100).toLocaleString()}) upfront. California Home Improvement Contract law limits deposits to 10% or $1,000 — whichever is less. You have the right to ask for a revised payment schedule.`,
      derivedFrom: ["Proposal payment terms", "CA B&P Code §7159"],
      placement: "payment_section",
    });
  }

  // License expiring soon
  if (licenseData?.is_active && licenseData.expire_date) {
    try {
      const expDate = new Date(licenseData.expire_date);
      const daysUntilExp = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExp > 0 && daysUntilExp < 90) {
        tips.push({
          id: "license-expiring",
          trigger: "license_verification",
          headline: "License expires during your project",
          body: `This license expires ${expDate.toLocaleDateString()} — that's ${daysUntilExp} days from now. If your project runs 12+ weeks, the license could lapse mid-construction. Ask your contractor to confirm they'll renew. An expired license means failed inspections.`,
          derivedFrom: ["CSLB license record", "Projected timeline"],
          placement: "license_section",
        });
      }
    } catch { /* ignore date parse errors */ }
  }

  // Contractor juggling many projects
  if (permitStats && permitStats.active_permits >= 4) {
    tips.push({
      id: "juggling-projects",
      trigger: "contractor_history",
      headline: `Your contractor has ${permitStats.active_permits} active projects`,
      body: `We found ${permitStats.active_permits} open permits under this contractor right now. Busy contractors are often good contractors, but it's worth asking: "How many projects are you running right now, and who will be my on-site lead?"`,
      derivedFrom: ["San Jose permit records (active status)", "Proposal contractor name"],
      placement: "permit_history_section",
    });
  }

  // Price comparison
  if (permitStats?.avg_valuation && contractVal > 0) {
    const pctDiff = Math.round(((contractVal - permitStats.avg_valuation) / permitStats.avg_valuation) * 100);
    if (Math.abs(pctDiff) > 25) {
      tips.push({
        id: "price-comparison",
        trigger: "score_card",
        headline: pctDiff > 0
          ? "This is higher than their typical project"
          : "This is lower than their typical range",
        body: pctDiff > 0
          ? `At $${contractVal.toLocaleString()}, this proposal is ${pctDiff}% above this contractor's average project value of $${permitStats.avg_valuation.toLocaleString()} in San Jose. That could mean your project is more complex — or there's room to negotiate.`
          : `At $${contractVal.toLocaleString()}, this is ${Math.abs(pctDiff)}% below this contractor's average ($${permitStats.avg_valuation.toLocaleString()}). Could be a great deal — or the scope is lighter than you think.`,
        derivedFrom: ["Proposal total cost", "San Jose permit valuations"],
        placement: "score_section",
      });
    }
  }

  // Prioritize and return top 2
  const priorityOrder = ["downpayment-law", "license-expiring", "timeline-reality", "juggling-projects", "price-comparison"];
  tips.sort((a, b) => {
    const aIdx = priorityOrder.indexOf(a.id);
    const bIdx = priorityOrder.indexOf(b.id);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return tips.slice(0, 2);
}

// ─── Risk Scoring ──────────────────────────────────────────────────
function calculateRiskScore(
  extracted: ExtractedData,
  permitStats: any,
  licenseData: any,
  redFlags: RedFlag[],
  insights: Insight[],
) {
  // Deduction-based scoring (per spec)
  let score = 100;

  redFlags.forEach((flag) => {
    if (flag.severity === "critical") score -= 25;
    if (flag.severity === "warning") score -= 10;
    if (flag.severity === "notice") score -= 3;
  });

  // Small boosts for positive signals
  const positives = insights.filter((i) => i.type === "positive").length;
  score += Math.min(positives * 3, 10);

  score = Math.max(0, Math.min(100, score));

  let label: string;
  let summary: string;

  if (score >= 85) {
    label = "Looking Good";
    summary = "This proposal checks out well. Review the details below, but we don't see major concerns.";
  } else if (score >= 65) {
    label = "Some Concerns";
    summary = "We found a few things worth discussing with your contractor before signing. See the flagged items below.";
  } else if (score >= 40) {
    label = "Proceed with Caution";
    summary = "There are significant concerns with this proposal. We strongly recommend addressing these before signing.";
  } else {
    label = "Major Red Flags";
    summary = "We found serious issues. Consider getting additional proposals from other contractors before proceeding.";
  }

  // Also keep category breakdown for the detailed view
  const categories = buildCategoryBreakdown(extracted, permitStats, licenseData);

  return { overall: score, label, summary, categories };
}

function buildCategoryBreakdown(extracted: ExtractedData, permitStats: any, licenseData: any) {
  const categories: any[] = [];

  // Payment Risk
  let paymentScore = 70;
  const depositStr = extracted.deposit_percentage || "";
  const depositNum = parseFloat(depositStr.replace(/[^0-9.]/g, ""));
  if (depositNum > 0) {
    if (depositNum <= 10) paymentScore = 95;
    else if (depositNum <= 15) paymentScore = 85;
    else if (depositNum <= 25) paymentScore = 65;
    else if (depositNum <= 33) paymentScore = 50;
    else paymentScore = 30;
  }
  categories.push({ name: "Payment Structure", weight: 20, score: paymentScore,
    explanation: depositNum > 20 ? `${depositNum}% deposit exceeds recommended 10-15%.` : depositNum > 0 ? `${depositNum}% deposit is within acceptable range.` : "Deposit terms not clearly specified." });

  // Legal
  let legalScore = 60;
  if (extracted.dispute_resolution && extracted.dispute_resolution !== "Not specified") legalScore += 15;
  if (extracted.warranty_terms && extracted.warranty_terms !== "Not specified") legalScore += 10;
  categories.push({ name: "Legal Protection", weight: 20, score: Math.min(legalScore, 100),
    explanation: extracted.dispute_resolution !== "Not specified" ? "Dispute resolution clause found." : "No dispute resolution clause. Add one before signing." });

  // Change Orders
  let coScore = extracted.change_order_policy && extracted.change_order_policy !== "Not specified" ? 80 : 40;
  categories.push({ name: "Change Order Risk", weight: 15, score: coScore,
    explanation: coScore >= 80 ? "Change order process is defined." : "No change order policy. This is the #1 source of budget overruns." });

  // Scope
  let scopeScore = 60;
  if (extracted.materials_specified) scopeScore += 15;
  if (extracted.project_scope && extracted.project_scope.length > 30) scopeScore += 10;
  categories.push({ name: "Scope Clarity", weight: 15, score: Math.min(scopeScore, 100),
    explanation: extracted.materials_specified ? "Materials and specs are detailed." : "Specifications are vague. Ask for detailed materials list." });

  // Timeline
  let timelineScore = 40;
  if (extracted.start_date && extracted.start_date !== "Not specified") timelineScore += 15;
  if (extracted.end_date && extracted.end_date !== "Not specified") timelineScore += 25;
  if (extracted.timeline && extracted.timeline !== "Not specified") timelineScore += 10;
  categories.push({ name: "Timeline", weight: 15, score: Math.min(timelineScore, 100),
    explanation: extracted.end_date !== "Not specified" ? `End date: ${extracted.end_date}` : "No end date specified — a significant concern." });

  // Public Record
  let publicScore = 50;
  if (permitStats?.total_permits > 0) publicScore += 10;
  if (permitStats?.total_permits > 10) publicScore += 10;
  if (permitStats?.finaled_percentage >= 80) publicScore += 15;
  if (licenseData?.is_active) publicScore += 10;
  if (licenseData?.verified) publicScore += 5;
  categories.push({ name: "Public Record", weight: 15, score: Math.min(publicScore, 100),
    explanation: permitStats?.total_permits > 0
      ? `${permitStats.total_permits} permits found. ${permitStats.finaled_percentage}% finaled. ${licenseData?.is_active ? "License active." : ""}`
      : "No permit records found in San Jose." });

  return categories;
}

// ─── Questions to Ask ──────────────────────────────────────────────
function generateQuestionsToAsk(
  redFlags: RedFlag[],
  extracted: ExtractedData,
  permitStats: any,
  licenseData: any,
): string[] {
  const questions: string[] = [];

  // From red flags
  for (const flag of redFlags) {
    if (flag.category === "Payment" && flag.severity !== "notice") {
      questions.push(`"Can we restructure the payment schedule so I'm paying for completed work, not work that hasn't started?"`);
    }
    if (flag.category === "License" && flag.title.includes("complaint")) {
      questions.push(`"I noticed ${licenseData.complaint_count} complaint(s) on your CSLB record. Can you tell me what happened?"`);
    }
  }

  if (!extracted.change_order_policy || extracted.change_order_policy === "Not specified") {
    questions.push(`"How do you handle change orders? Can we add a clause that all changes need written approval with revised pricing before any work begins?"`);
  }

  if (!extracted.end_date || extracted.end_date === "Not specified") {
    questions.push(`"Can we add a completion date to the contract? What's a realistic timeline for this project?"`);
  }

  if (permitStats?.active_permits >= 3) {
    questions.push(`"How many projects are you managing right now? Who will be my on-site lead, and how often will they be here?"`);
  }

  if (!extracted.warranty_terms || extracted.warranty_terms === "Not specified") {
    questions.push(`"What kind of warranty do you offer on workmanship? Can we put that in writing?"`);
  }

  questions.push(`"Can you give me references from your last 3 completed kitchen projects in San Jose?"`);

  // Deduplicate and cap at 6
  return [...new Set(questions)].slice(0, 6);
}

// ─── Roadmap Generator ─────────────────────────────────────────────
function generateRoadmap(extracted: ExtractedData) {
  const scope = (extracted.project_scope || "").toLowerCase();
  const isKitchen = scope.includes("kitchen");
  const isBathroom = scope.includes("bath");

  const stages = [
    { stage: "Planning & Design", duration: "2–4 weeks", description: "Finalize design, select materials, obtain contractor agreement", inspections: 0 },
    { stage: "Permits", duration: "4–8 weeks", description: "Submit permit applications to City of San Jose. Plan review typically takes 4-6 weeks.", inspections: 0 },
    { stage: "Demolition", duration: "1–2 weeks", description: "Selective demo of existing structures. Debris removal and site prep.", inspections: 1 },
    { stage: "Rough Work", duration: "2–4 weeks", description: "Framing, electrical rough-in, plumbing rough-in, HVAC modifications", inspections: 3, critical: true },
    { stage: "Drywall & Paint", duration: "1–2 weeks", description: "Drywall installation, taping, texturing, priming, painting", inspections: 1 },
  ];

  if (isKitchen) {
    stages.push(
      { stage: "Cabinets & Countertops", duration: "2–3 weeks", description: "Cabinet installation, countertop templating and installation. Order cabinets in Week 1 — they take 12-16 weeks!", inspections: 0, critical: true },
      { stage: "Fixtures & Appliances", duration: "1–2 weeks", description: "Install sink, faucet, appliances, backsplash, hardware", inspections: 1 },
    );
  } else if (isBathroom) {
    stages.push(
      { stage: "Tile & Waterproofing", duration: "2–3 weeks", description: "Waterproofing, tile installation, grout", inspections: 1, critical: true },
      { stage: "Fixtures & Finishes", duration: "1–2 weeks", description: "Vanity, toilet, shower door, mirrors, accessories", inspections: 1 },
    );
  } else {
    stages.push(
      { stage: "Finishes & Fixtures", duration: "2–3 weeks", description: "Flooring, trim, fixtures, hardware, final details", inspections: 1 },
    );
  }

  stages.push({
    stage: "Final Inspection & Walkthrough",
    duration: "1–2 weeks",
    description: "City final inspection, punch list walkthrough, certificate of completion. Hold 10-15% until punchlist resolved.",
    inspections: 1,
    critical: true,
  });

  return stages;
}

// ─── Next Actions ──────────────────────────────────────────────────
function generateNextActions(extracted: ExtractedData, permitStats: any, licenseData: any) {
  const actions: any[] = [];

  if (licenseData?.detail_url) {
    actions.push({
      priority: "high",
      action: "Verify contractor license on CSLB website",
      detail: `Confirm license #${extracted.license_number} is active and in good standing.`,
      url: licenseData.detail_url,
      deadline: "Before signing",
    });
  }

  const depositNum = parseFloat((extracted.deposit_percentage || "0").replace(/[^0-9.]/g, ""));
  if (depositNum > 15) {
    actions.push({
      priority: "high",
      action: "Negotiate deposit percentage",
      detail: `${depositNum}% is above industry standard and CA law. Ask for 10% or $1,000, whichever is less.`,
      deadline: "Before signing",
    });
  }

  if (!extracted.change_order_policy || extracted.change_order_policy === "Not specified") {
    actions.push({
      priority: "high",
      action: "Request written change order policy",
      detail: "All scope changes, pricing adjustments, and timeline extensions must be in writing before work begins.",
      deadline: "Before signing",
    });
  }

  if (!extracted.end_date || extracted.end_date === "Not specified") {
    actions.push({
      priority: "medium",
      action: "Request project completion date",
      detail: "Add a specific 'substantial completion' date with reasonable penalties for delays.",
      deadline: "Before signing",
    });
  }

  if (!extracted.permits_mentioned) {
    actions.push({
      priority: "medium",
      action: "Confirm who pulls permits",
      detail: "Clarify whether the contractor handles all permit applications and inspections.",
      deadline: "Before signing",
    });
  }

  if (!extracted.warranty_terms || extracted.warranty_terms === "Not specified") {
    actions.push({
      priority: "medium",
      action: "Request warranty terms",
      detail: "Ask for minimum 1-year workmanship warranty and pass-through manufacturer warranties.",
      deadline: "Before signing",
    });
  }

  if (permitStats && permitStats.total_permits === 0) {
    actions.push({
      priority: "high",
      action: "Investigate contractor's permit history",
      detail: "No permits found in San Jose. Ask for references and permit numbers from past projects.",
      deadline: "Before signing",
    });
  }

  actions.push({
    priority: "low",
    action: "Get 2-3 comparable bids",
    detail: "Even if you like this contractor, comparison bids help validate pricing and scope.",
    deadline: "Within 2 weeks",
  });

  return actions;
}

// ─── Main Handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { file_base64, file_name, address_lookup } = await req.json();

    // Handle address-based permit lookup
    if (address_lookup) {
      const addressPermits = await fetchPermitsByAddress(address_lookup);
      return new Response(JSON.stringify({ success: true, ...addressPermits }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file_base64 || !file_name) {
      return new Response(
        JSON.stringify({ success: false, error: "file_base64 and file_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing proposal: ${file_name}`);

    // Step 1: Extract proposal data via LLM
    const extracted = await extractProposalData(file_base64, file_name, LOVABLE_API_KEY);
    console.log("Extracted data:", JSON.stringify(extracted));

    // Step 2: Fetch permit intelligence from San Jose
    let permitResult = { permits: [] as any[], stats: null as any, error: null as any };
    if (extracted.contractor_name && extracted.contractor_name !== "Unknown") {
      permitResult = await fetchSanJosePermits(extracted.contractor_name) as any;
    }

    // Step 3: Verify CSLB license
    let licenseResult: any = { verified: false, status: "not_checked" };
    if (extracted.license_number && extracted.license_number !== "Not specified") {
      licenseResult = await verifyCSLBLicense(extracted.license_number);
    }

    // Step 4: Cross-reference analysis — Red Flags
    const redFlags = identifyRedFlags(extracted, licenseResult, permitResult.stats);

    // Step 5: Positive Signals
    const insights = generateInsights(extracted, licenseResult, permitResult.stats);

    // Step 6: Haleo Contextual Tips
    const haleoTips = generateHaleoTips(extracted, licenseResult, permitResult.stats);

    // Step 7: Questions to Ask
    const questionsToAsk = generateQuestionsToAsk(redFlags, extracted, permitResult.stats, licenseResult);

    // Step 8: Calculate risk score (deduction-based per spec)
    const riskScore = calculateRiskScore(extracted, permitResult.stats, licenseResult, redFlags, insights);

    // Step 9: Generate roadmap
    const roadmap = generateRoadmap(extracted);

    // Step 10: Generate next actions
    const nextActions = generateNextActions(extracted, permitResult.stats, licenseResult);

    // Step 11: Generate narrative
    const permitNarrative =
      permitResult.stats && permitResult.stats.total_permits > 0
        ? `We searched San Jose's building permit database and found ${permitResult.stats.total_permits} permits filed under ${extracted.contractor_name}. ${permitResult.stats.finaled_percentage}% have been finaled (completed and signed off by city inspectors).${permitResult.stats.avg_duration_weeks ? ` Their average project takes about ${permitResult.stats.avg_duration_weeks} weeks from permit to final.` : ""} ${permitResult.stats.years_active ? `They've been active in San Jose for about ${permitResult.stats.years_active} years.` : ""}`
        : `We searched San Jose's building permit database and didn't find records matching "${extracted.contractor_name}." This doesn't necessarily mean something is wrong — they may work primarily in other cities, use a different business name on permits, or be relatively new to the area. We recommend asking them directly about their recent local projects.`;

    // Step 12: Save to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from("proposal_analyses")
      .insert({
        file_path: file_name,
        extracted_data: extracted,
        permit_data: { permits: permitResult.permits, stats: permitResult.stats },
        license_data: licenseResult,
        risk_score: riskScore.overall,
        risk_breakdown: riskScore.categories,
        roadmap,
        next_actions: nextActions,
      })
      .select()
      .single();

    if (saveError) console.error("Failed to save analysis:", saveError);

    const result = {
      success: true,
      analysis_id: savedAnalysis?.id || null,
      extracted,
      permit_intelligence: {
        permits: permitResult.permits.slice(0, 20),
        stats: permitResult.stats,
        narrative: permitNarrative,
        error: permitResult.error,
      },
      license_verification: licenseResult,
      risk_score: riskScore,
      red_flags: redFlags,
      insights,
      haleo_tips: haleoTips,
      questions_to_ask: questionsToAsk,
      roadmap,
      next_actions: nextActions,
    };

    console.log(`Analysis complete. Score: ${riskScore.overall}, Red flags: ${redFlags.length}, Insights: ${insights.length}, Haleo tips: ${haleoTips.length}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
