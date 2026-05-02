import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

function parseJsonFromText(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

router.post("/ai/autofill-brief", requireAuth, async (req: Request, res: Response) => {
  try {
    const { brief } = req.body as { brief?: string };
    if (!brief?.trim()) {
      res.status(400).json({ error: "brief required" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a business analyst. Given a one-sentence project brief, generate a structured feasibility study input form.
Return ONLY valid JSON with these fields:
projectName, industry (from: Information Technology, Telecommunications, Infrastructure & Construction, Government & Public Sector, Real Estate & Property, Healthcare & Life Sciences, Financial Services, Energy & Utilities, Manufacturing, Food & Beverage, Retail & E-commerce, Education, Other),
location, description (2-3 paragraphs), strategicObjectives (bullet points), businessModel (one of: SaaS / Subscription Software, Marketplace / Platform, Hardware / Devices, Professional Services, Consumer Product (D2C), Wholesale / Distribution, Infrastructure / Capex Project, Government Contract / PPP, Other),
revenueModel (one of: Recurring subscription, Transaction / commission fee, License / one-time sale, Usage-based metering, Advertising, Project / milestone billing, Tariff / regulated revenue, Mixed),
founderExperience, budgetRange (one of: < $50,000, $50,000 – $250,000, $250,000 – $1M, $1M – $5M, $5M – $25M, > $25M),
timeline (one of: < 3 months, 3 – 6 months, 6 – 12 months, 1 – 2 years, 2 – 5 years, > 5 years),
teamSize (one of: 1 – 5, 6 – 15, 16 – 50, 51 – 100, > 100),
dependencies, assumptions, constraints, successFactors, knownRisks, regulatoryConsiderations,
technologyReadiness (one of: Proven / Mature, Established / Widely Used, Emerging / Early Adoption, Experimental / R&D Phase, Unknown / Not Yet Assessed),
competitorUrls (empty string).`,
        },
        { role: "user", content: brief },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    let draft: unknown;
    try {
      draft = parseJsonFromText(text);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }
    res.json({ draft });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/ai/complete-field", requireAuth, async (req: Request, res: Response) => {
  try {
    const { field, partial, inputs } = req.body as {
      field?: string;
      partial?: string;
      inputs?: { projectName?: string; industry?: string; description?: string };
    };
    if (!field) {
      res.status(400).json({ error: "field required" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a business analyst helping fill out a feasibility study form.
Project context: ${JSON.stringify({ projectName: inputs?.projectName, industry: inputs?.industry, description: inputs?.description })}
Complete the "${field}" field. Return ONLY the completed text, no JSON, no explanation. 2-4 sentences or bullet points.`,
        },
        {
          role: "user",
          content: partial
            ? `Current draft: "${partial}"\nPlease complete and expand this.`
            : `Write a complete response for the "${field}" field.`,
        },
      ],
    });

    res.json({ text: completion.choices[0]?.message?.content ?? "" });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

router.post("/ai/analyze-concept", requireAuth, async (req: Request, res: Response) => {
  try {
    const { inputs } = req.body as { inputs?: unknown };
    if (!inputs) {
      res.status(400).json({ error: "inputs required" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a senior venture analyst. Perform a comprehensive FMART feasibility analysis.
Return ONLY valid JSON matching this exact structure:
{
  "reportId": "RPT-<6 random chars>",
  "dateIssued": "<ISO date>",
  "classification": "CONFIDENTIAL",
  "preparedBy": "Concept AI — FMART Engine v4",
  "methodology": "FMART (Financial, Market, Achievability, Risk, Timing) multi-dimensional scoring with weighted confidence intervals.",
  "executiveSummary": "<3-4 paragraph markdown summary>",
  "scores": {
    "financial": <0-10 float>,
    "market": <0-10 float>,
    "achievability": <0-10 float>,
    "risk": <0-10 float, higher = lower risk>,
    "timing": <0-10 float>,
    "operational": <0-10 float>,
    "overall": <0-10 float>,
    "verdict": "<PROCEED|PROCEED WITH CAUTION|REVISE|DO NOT PROCEED>",
    "financialFinding": "<1-2 sentences>",
    "marketFinding": "<1-2 sentences>",
    "achievabilityFinding": "<1-2 sentences>",
    "riskFinding": "<1-2 sentences>",
    "timingFinding": "<1-2 sentences>",
    "operationalFinding": "<1-2 sentences>",
    "weights": { "financial": 0.2, "market": 0.2, "achievability": 0.2, "risk": 0.15, "timing": 0.15, "operational": 0.1 },
    "confidence": { "financial": <0-1>, "market": <0-1>, "achievability": <0-1>, "risk": <0-1>, "timing": <0-1>, "operational": <0-1> },
    "rationale": { "financial": "<str>", "market": "<str>", "achievability": "<str>", "risk": "<str>", "timing": "<str>", "operational": "<str>" }
  },
  "market": {
    "tamLabel": "Total Addressable Market",
    "tamValue": "<value with currency>",
    "tamCagr": "<X.X%>",
    "samLabel": "Serviceable Addressable Market",
    "samValue": "<value with currency>",
    "samCagr": "<X.X%>",
    "somLabel": "Serviceable Obtainable Market",
    "somValue": "<value with currency>",
    "somCagr": "<X.X%>",
    "growthChart": [{"year":"2024","tam":<number>,"sam":<number>},{"year":"2025","tam":<number>,"sam":<number>},{"year":"2026","tam":<number>,"sam":<number>},{"year":"2027","tam":<number>,"sam":<number>},{"year":"2028","tam":<number>,"sam":<number>}],
    "currency": "<USD|SAR|EUR|GBP>"
  },
  "customer": {
    "ageLocation": "<str>",
    "income": "<str>",
    "goals": "<str>",
    "willingnessToPay": "<str>",
    "behavior": "<str>"
  },
  "competitors": [
    {"name":"<str>","model":"<str>","weakness":"<str>","edge":"<str>"},
    {"name":"<str>","model":"<str>","weakness":"<str>","edge":"<str>"},
    {"name":"<str>","model":"<str>","weakness":"<str>","edge":"<str>"}
  ],
  "financials": {
    "currency": "<USD|SAR|EUR>",
    "capExTotal": {"low":<number>,"high":<number>,"mid":<number>},
    "capEx": [
      {"category":"<str>","low":<number>,"high":<number>,"notes":"<str>"},
      {"category":"<str>","low":<number>,"high":<number>,"notes":"<str>"},
      {"category":"<str>","low":<number>,"high":<number>,"notes":"<str>"}
    ],
    "opEx": [
      {"category":"<str>","monthly":<number>,"annual":<number>},
      {"category":"<str>","monthly":<number>,"annual":<number>},
      {"category":"<str>","monthly":<number>,"annual":<number>}
    ],
    "scenarios": [
      {"scenario":"Optimistic","probability":"30%","subscribersYr1":"<str>","annualRevenue":"<str>","breakEven":"<str>"},
      {"scenario":"Base Case","probability":"50%","subscribersYr1":"<str>","annualRevenue":"<str>","breakEven":"<str>"},
      {"scenario":"Pessimistic","probability":"20%","subscribersYr1":"<str>","annualRevenue":"<str>","breakEven":"<str>"}
    ],
    "investmentRange": "<str>",
    "breakEvenSummary": "<str>",
    "ltvCacRatio": "<str>"
  },
  "risks": [
    {"name":"<str>","probability":"<Low|Med|High>","impact":"<Low|Med|High>","level":"<Low|Med|High>","mitigation":"<str>"},
    {"name":"<str>","probability":"<Low|Med|High>","impact":"<Low|Med|High>","level":"<Low|Med|High>","mitigation":"<str>"},
    {"name":"<str>","probability":"<Low|Med|High>","impact":"<Low|Med|High>","level":"<Low|Med|High>","mitigation":"<str>"},
    {"name":"<str>","probability":"<Low|Med|High>","impact":"<Low|Med|High>","level":"<Low|Med|High>","mitigation":"<str>"},
    {"name":"<str>","probability":"<Low|Med|High>","impact":"<Low|Med|High>","level":"<Low|Med|High>","mitigation":"<str>"}
  ],
  "fundingMix": [
    {"source":"<str>","share":"<X%>","amount":"<str>","rationale":"<str>"},
    {"source":"<str>","share":"<X%>","amount":"<str>","rationale":"<str>"},
    {"source":"<str>","share":"<X%>","amount":"<str>","rationale":"<str>"}
  ],
  "fundingAdvisory": "<2-3 sentences>",
  "recommendations": ["<str>","<str>","<str>","<str>","<str>"],
  "nextSteps": ["<str>","<str>","<str>","<str>","<str>"]
}`,
        },
        {
          role: "user",
          content: `Analyze this project:\n${JSON.stringify(inputs, null, 2)}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    let report: unknown;
    try {
      report = parseJsonFromText(text);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }
    res.json(report);
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;
