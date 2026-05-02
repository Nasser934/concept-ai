import type { ConceptInputs, FeasibilityReport } from "@/types/analysis";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export interface ReportRow {
  id: string;
  slug: string;
  userId: string;
  title: string;
  industry: string | null;
  inputs: ConceptInputs;
  output: FeasibilityReport;
  status: "draft" | "in_review" | "approved" | "rejected";
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function saveReport(inputs: ConceptInputs, output: FeasibilityReport) {
  return apiFetch("/api/reports", {
    method: "POST",
    body: JSON.stringify({ title: inputs.projectName || "Untitled analysis", industry: inputs.industry || null, inputs, output }),
  }) as Promise<{ id: string; slug: string }>;
}

export async function getReportBySlug(slug: string): Promise<ReportRow | null> {
  return apiFetch(`/api/reports/slug/${slug}`).catch(() => null);
}

export async function listMyReports() {
  return apiFetch("/api/reports") as Promise<ReportRow[]>;
}

export async function deleteReport(id: string) {
  return apiFetch(`/api/reports/${id}`, { method: "DELETE" });
}

export async function updateReportStatus(id: string, status: ReportRow["status"], note?: string) {
  return apiFetch(`/api/reports/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

export async function publishReport(id: string) {
  return apiFetch(`/api/reports/${id}/publish`, { method: "POST" }) as Promise<{
    id: string;
    slug: string;
    isPublic: boolean;
  }>;
}

export async function unpublishReport(id: string) {
  return apiFetch(`/api/reports/${id}/unpublish`, { method: "POST" }) as Promise<{
    id: string;
    slug: string;
    isPublic: boolean;
  }>;
}

export async function autofillBrief(brief: string) {
  return apiFetch("/api/ai/autofill-brief", {
    method: "POST",
    body: JSON.stringify({ brief }),
  }) as Promise<{ draft: ConceptInputs }>;
}

export async function completeField(field: string, partial: string, inputs: ConceptInputs) {
  return apiFetch("/api/ai/complete-field", {
    method: "POST",
    body: JSON.stringify({ field, partial, inputs }),
  }) as Promise<{ text: string }>;
}

export async function analyzeConcept(inputs: ConceptInputs) {
  return apiFetch("/api/ai/analyze-concept", {
    method: "POST",
    body: JSON.stringify({ inputs }),
  }) as Promise<FeasibilityReport>;
}
