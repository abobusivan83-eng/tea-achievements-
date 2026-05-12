import { getApiClient } from "./client";
import { parseEnvelope } from "./http";

export type SupportEvidencePick = { uri: string; name: string; type: string };

export async function createSupportSuggestion(body: { title: string; description: string }): Promise<{ id: string }> {
  const client = getApiClient();
  return parseEnvelope<{ id: string }>(client, {
    method: "POST",
    url: "/api/support/suggestions",
    data: body,
  });
}

export async function uploadSupportSuggestionImages(suggestionId: string, files: SupportEvidencePick[]): Promise<void> {
  if (!files.length) return;
  const client = getApiClient();
  const form = new FormData();
  for (const f of files) {
    form.append("files", { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  }
  await parseEnvelope<unknown>(client, {
    method: "POST",
    url: `/api/support/suggestions/${suggestionId}/images`,
    data: form,
  });
}

export async function createSupportReport(body: {
  reportedId: string;
  reason: "spam" | "insult" | "cheat" | "other";
  description: string;
}): Promise<{ id: string }> {
  const client = getApiClient();
  return parseEnvelope<{ id: string }>(client, {
    method: "POST",
    url: "/api/support/reports",
    data: body,
  });
}

export async function uploadSupportReportImages(reportId: string, files: SupportEvidencePick[]): Promise<void> {
  if (!files.length) return;
  const client = getApiClient();
  const form = new FormData();
  for (const f of files) {
    form.append("files", { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  }
  await parseEnvelope<unknown>(client, {
    method: "POST",
    url: `/api/support/reports/${reportId}/images`,
    data: form,
  });
}
