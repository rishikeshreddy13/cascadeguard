import { randomUUID } from "node:crypto";

type Evidence = {
  evidenceId: string;
  source: string;
  sourceUrl: string;
  timestamp: string;
  location: Record<string, unknown>;
  claim: string;
  dataType: string;
  sourceTier: string;
  confidence: number;
  confidenceBasis: string;
  metadata: Record<string, unknown>;
};

type CandidateRisk = {
  id: string;
  title: string;
  chain: string[];
  priority: "critical" | "high" | "medium";
  rationale: string;
  evidenceIds: string[];
  intervention: string;
};

export type Scenario = {
  id: string;
  title: string;
  region: string;
  event: string;
  mode: "replay";
  sourceNotice: string;
  eventEvidence: Evidence[];
  infrastructureEvidence: Evidence[];
  candidateRisks: CandidateRisk[];
};

type ProviderDecision = {
  priority?: "critical" | "high" | "medium";
  intervention?: string;
  why?: string;
  confidence?: number;
  uncertainty?: string[];
};

export type AnalysisResult = {
  runId: string;
  mode: "replay" | "live";
  scenarioId: string;
  title: string;
  event: string;
  location: string;
  priority: "critical" | "high" | "medium";
  cascade: Array<{
    id: string;
    label: string;
    kind: "event" | "failure" | "dependency" | "impact" | "intervention";
    confidence: number;
    evidenceIds: string[];
  }>;
  impact: string;
  intervention: string;
  why: string;
  confidence: number;
  evidence: Evidence[];
  uncertainty: string[];
  trace: Array<{
    id: string;
    label: string;
    detail: string;
    status: "complete" | "active" | "warning";
  }>;
  candidates: CandidateRisk[];
  provider: "featherless" | "replay-engine";
  providerStatus: "available" | "fallback" | "not-configured";
  sourceNotice: string;
  generatedAt: string;
};

const eventEvidence: Evidence = {
  evidenceId: "557b71dbb58e1f68",
  source: "GDACS RSS / European Commission Joint Research Centre",
  sourceUrl: "https://www.gdacs.org/report.aspx?eventtype=FL&eventid=1104124",
  timestamp: "Tue, 01 Sep 2026 13:57:04 GMT",
  location: {
    country: "Nepal",
    iso3: "NPL",
    latitude: 27.2952744,
    longitude: 85.3649145,
  },
  claim:
    "On 26/08/2026, a flood started in Nepal, lasting until 01/09/2026 (last update). The flood caused 955 deaths and 3458 displaced.",
  dataType: "disaster_event",
  sourceTier: "international_monitoring",
  confidence: 0.9,
  confidenceBasis: "Current public GDACS event feed; not field verification.",
  metadata: {
    title: "Red flood alert in Nepal",
    eventType: "FL",
    eventId: "1104124",
    glide: "FL-2026-000167-NPL",
    alertLevel: "Red",
    alertScore: 3,
    isCurrent: true,
    affectedPopulation: "955",
  },
};

const infrastructureEvidence: Evidence[] = [
  {
    evidenceId: "267128dfe06f33ad",
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/way/195249439",
    timestamp: "2023-09-17T11:16:18Z",
    location: { latitude: 27.2954183, longitude: 85.3644983, distanceKm: 0.055 },
    claim: "OpenStreetMap maps a secondary road within 0.05 km of the event.",
    dataType: "infrastructure_feature",
    sourceTier: "open_geographic_data",
    confidence: 0.7,
    confidenceBasis:
      "Mapped feature presence; operational status and current condition are not verified.",
    metadata: {
      osmType: "way",
      osmId: "195249439",
      category: "highway",
      kind: "secondary",
      name: "Event-area secondary road",
      tags: { highway: "secondary" },
    },
  },
  {
    evidenceId: "1d68363c77413299",
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/way/906588783",
    timestamp: "2021-02-12T15:12:52Z",
    location: { latitude: 27.2963596, longitude: 85.3652545, distanceKm: 0.155 },
    claim: "OpenStreetMap maps a water works within 0.16 km of the event.",
    dataType: "infrastructure_feature",
    sourceTier: "open_geographic_data",
    confidence: 0.7,
    confidenceBasis:
      "Mapped feature presence; operational status and current condition are not verified.",
    metadata: {
      osmType: "way",
      osmId: "906588783",
      category: "man_made",
      kind: "water_works",
      name: null,
      tags: { manMade: "water_works" },
    },
  },
  {
    evidenceId: "0b3388a2f17b7289",
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/way/221295616",
    timestamp: "2017-09-07T09:15:21Z",
    location: { latitude: 27.2985412, longitude: 85.3629852, distanceKm: 0.179 },
    claim: "OpenStreetMap maps a school within 0.18 km of the event.",
    dataType: "infrastructure_feature",
    sourceTier: "open_geographic_data",
    confidence: 0.7,
    confidenceBasis:
      "Mapped feature presence; operational status and current condition are not verified.",
    metadata: {
      osmType: "way",
      osmId: "221295616",
      category: "amenity",
      kind: "school",
      name: "Pushpa Bal Academy",
      tags: { amenity: "school" },
    },
  },
];

const candidateRisks: CandidateRisk[] = [
  {
    id: "access-service-delivery",
    title: "Access disruption threatens essential service delivery",
    chain: [
      "Red flood alert",
      "Access route condition uncertain",
      "Supply delivery may slow",
      "Critical services exposed",
    ],
    priority: "critical",
    rationale:
      "A mapped road close to the flood location creates a high-leverage dependency to verify first, while the flood record indicates severe human consequences.",
    evidenceIds: ["557b71dbb58e1f68", "267128dfe06f33ad"],
    intervention: "Pre-position essential supplies before access is re-verified.",
  },
  {
    id: "water-health",
    title: "Water-system disruption may increase health risk",
    chain: [
      "Red flood alert",
      "Mapped water works exposed",
      "Water service disruption possible",
      "Health risk may rise",
    ],
    priority: "high",
    rationale:
      "A mapped water works is nearby, but this replay contains no evidence of contamination or an outage.",
    evidenceIds: ["557b71dbb58e1f68", "1d68363c77413299"],
    intervention: "Verify water-system status and prepare safe-water alternatives.",
  },
  {
    id: "shelter-pressure",
    title: "Displacement can increase pressure on local facilities",
    chain: [
      "People displaced",
      "Shelter demand increases",
      "Nearby facilities may absorb demand",
    ],
    priority: "medium",
    rationale:
      "GDACS reports displacement and OSM maps a school, but the replay does not establish that the school is a shelter or that capacity is available.",
    evidenceIds: ["557b71dbb58e1f68", "0b3388a2f17b7289"],
    intervention: "Confirm shelter capacity with local responders before directing people.",
  },
];

const scenario: Scenario = {
  id: "nepal-flood-2026",
  title: "Nepal flood: event-location infrastructure replay",
  region: "Nepal · GDACS event location",
  event: "Red flood alert",
  mode: "replay",
  sourceNotice:
    "Replay of evidence collected from the public GDACS RSS feed and OpenStreetMap on 04 Sep 2026. Mapped features confirm presence only; they do not establish damage, obstruction, or operation.",
  eventEvidence: [eventEvidence],
  infrastructureEvidence,
  candidateRisks,
};

const replayTrace = [
  {
    id: "trace-event",
    label: "Event evidence loaded",
    detail: "GDACS reports a red flood alert in Nepal with displacement recorded.",
    status: "complete" as const,
  },
  {
    id: "trace-infrastructure",
    label: "Geographic dependencies checked",
    detail: "OpenStreetMap evidence identifies a nearby road, water works, and school.",
    status: "complete" as const,
  },
  {
    id: "trace-hypotheses",
    label: "Candidate cascades generated",
    detail: "Access, water, and shelter pathways are compared without claiming damage.",
    status: "complete" as const,
  },
  {
    id: "trace-ranking",
    label: "Highest-leverage cascade selected",
    detail: "Access disruption is prioritized because it can affect downstream delivery.",
    status: "complete" as const,
  },
  {
    id: "trace-intervention",
    label: "Intervention point identified",
    detail: "Pre-positioning supplies can reduce dependency on an uncertain route.",
    status: "complete" as const,
  },
  {
    id: "trace-uncertainty",
    label: "Uncertainty preserved",
    detail: "Mapped presence is not treated as proof of current operating condition.",
    status: "warning" as const,
  },
];

export function getNepalScenario(): Scenario {
  return structuredClone(scenario);
}

export async function analyzeCascade(
  goal: string,
  mode: "replay" | "live",
  maxSteps: number,
): Promise<AnalysisResult> {
  const evidence = [...scenario.eventEvidence, ...scenario.infrastructureEvidence];
  const selected = candidateRisks[0];
  const base: AnalysisResult = {
    runId: randomUUID(),
    mode,
    scenarioId: scenario.id,
    title: scenario.title,
    event: scenario.event,
    location: "27.2953° N, 85.3649° E",
    priority: selected.priority,
    cascade: [
      {
        id: "flood-event",
        label: "Red flood alert",
        kind: "event",
        confidence: 0.9,
        evidenceIds: ["557b71dbb58e1f68"],
      },
      {
        id: "access-uncertain",
        label: "Nearby access route condition uncertain",
        kind: "dependency",
        confidence: 0.48,
        evidenceIds: ["267128dfe06f33ad"],
      },
      {
        id: "delivery-risk",
        label: "Essential supply delivery may slow",
        kind: "impact",
        confidence: 0.32,
        evidenceIds: [],
      },
      {
        id: "service-exposure",
        label: "Critical services exposed",
        kind: "impact",
        confidence: 0.26,
        evidenceIds: [],
      },
      {
        id: "preposition-supplies",
        label: "Pre-position essential supplies",
        kind: "intervention",
        confidence: 0.72,
        evidenceIds: [],
      },
    ],
    impact:
      "If the nearby route is obstructed, downstream deliveries may slow while people are already displaced. This is a decision-support hypothesis, not a verified closure report.",
    intervention: selected.intervention,
    why:
      "It breaks the chain before route access becomes the single point of failure and does not require claiming that the mapped road is currently damaged.",
    confidence: 0.68,
    evidence,
    uncertainty: [
      "OpenStreetMap confirms mapped feature presence, not current route condition.",
      "This replay contains no field verification of road damage, water outage, or shelter capacity.",
      "Human responders must verify conditions before acting.",
    ],
    trace: replayTrace.map((item) => ({ ...item })),
    candidates: candidateRisks.map((item) => ({ ...item, chain: [...item.chain], evidenceIds: [...item.evidenceIds] })),
    provider: "replay-engine",
    providerStatus: mode === "live" ? "fallback" : "not-configured",
    sourceNotice: scenario.sourceNotice,
    generatedAt: new Date().toISOString(),
  };

  if (mode === "live") {
    const providerDecision = await askFeatherless(goal, evidence, maxSteps);
    if (providerDecision) {
      return applyProviderDecision(base, providerDecision);
    }
  }

  return base;
}

async function askFeatherless(
  goal: string,
  evidence: Evidence[],
  maxSteps: number,
): Promise<ProviderDecision | null> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const prompt = [
    `Investigation goal: ${goal}`,
    `Bounded investigation steps: ${maxSteps}`,
    "Return JSON only with priority, intervention, why, confidence, and uncertainty.",
    "Use only the evidence below. Do not claim mapped infrastructure is damaged or operating.",
    JSON.stringify(evidence),
  ].join("\n\n");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: process.env.FEATHERLESS_MODEL ?? "Qwen/Qwen2.5-7B-Instruct",
        messages: [
          {
            role: "system",
            content:
              "You are a disaster decision-support reasoning component. Never issue commands or claim certainty.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 320,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const candidate = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(candidate) as ProviderDecision;
    if (
      parsed.priority &&
      !["critical", "high", "medium"].includes(parsed.priority)
    ) {
      return null;
    }
    if (
      parsed.confidence !== undefined &&
      (typeof parsed.confidence !== "number" ||
        parsed.confidence < 0 ||
        parsed.confidence > 1)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function applyProviderDecision(
  base: AnalysisResult,
  decision: ProviderDecision,
): AnalysisResult {
  const selected = base.candidates[0];
  return {
    ...base,
    priority: decision.priority ?? base.priority,
    intervention: decision.intervention ?? base.intervention,
    why: decision.why ?? base.why,
    confidence: decision.confidence ?? base.confidence,
    uncertainty: decision.uncertainty?.length
      ? decision.uncertainty
      : base.uncertainty,
    provider: "featherless",
    providerStatus: "available",
    trace: [
      ...base.trace.slice(0, -1),
      {
        id: "trace-featherless",
        label: "Featherless reviewed the evidence",
        detail: `The model evaluated ${selected.title.toLowerCase()} against the replay evidence.`,
        status: "complete",
      },
      base.trace.at(-1)!,
    ],
  };
}