import type {
  BatchUploadResponse,
  DocumentResponse,
  InvoiceCorrectionPayload,
  SystemHealth,
} from '../types/document';

const API_BASE = '/api/documents';

export async function checkSystemHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDocuments(params?: {
  q?: string;
  mode?: 'hybrid' | 'keyword' | 'semantic';
  status?: string;
}): Promise<DocumentResponse[]> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.mode) searchParams.set('mode', params.mode);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);

  const url = searchParams.toString() ? `${API_BASE}?${searchParams.toString()}` : API_BASE;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch documents: ${res.statusText}`);
  }
  return res.json();
}

export async function clearAllDocuments(): Promise<void> {
  const res = await fetch(API_BASE, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to clear documents');
  }
}

export async function getDocument(fileId: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/${fileId}`);
  if (!res.ok) {
    throw new Error(`Failed to get document: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadDocuments(files: File[]): Promise<BatchUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function correctDocument(
  fileId: string,
  payload: InvoiceCorrectionPayload
): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/${fileId}/correct`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Correction failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function reprocessDocument(fileId: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/${fileId}/reprocess`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Reprocess failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function runSampleDocuments(): Promise<BatchUploadResponse> {
  const res = await fetch(`${API_BASE}/samples/run`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sample run failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function listSampleFiles(): Promise<{
  samples: { name: string; size_bytes: number; extension: string }[];
}> {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) {
    throw new Error('Failed to fetch sample list');
  }
  return res.json();
}

export async function fetchStatsSummary(): Promise<{
  total: number;
  verified: number;
  needs_attention: number;
  failed: number;
}> {
  const res = await fetch(`${API_BASE}/stats/summary`);
  if (!res.ok) {
    throw new Error('Failed to fetch stats summary');
  }
  return res.json();
}

export async function fetchEvaluationMetrics(): Promise<any> {
  const res = await fetch('/api/evaluation/metrics');
  if (!res.ok) {
    throw new Error('Failed to fetch evaluation metrics');
  }
  return res.json();
}
