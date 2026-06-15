import type {
  CreateRedeemRequest,
  CreateRedeemResponse,
  RedeemJob,
} from "./contracts";
import { BACKEND_API_BASE_URL } from "./contracts";
import { requestJson } from "./http-client";

export class RedeemApiUnavailableError extends Error {
  constructor() {
    super("后端兑换接口未配置，请设置 NEXT_PUBLIC_BACKEND_API_BASE_URL。");
    this.name = "RedeemApiUnavailableError";
  }
}

function requireBackendUrl() {
  if (!BACKEND_API_BASE_URL) {
    throw new RedeemApiUnavailableError();
  }
  return BACKEND_API_BASE_URL;
}

export async function createRedeemJob(
  payload: CreateRedeemRequest,
  signal?: AbortSignal,
): Promise<CreateRedeemResponse> {
  const baseUrl = requireBackendUrl();
  return requestJson<CreateRedeemResponse>(`${baseUrl}/redeem`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Idempotency-Key": payload.idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function getRedeemJob(jobId: string): Promise<RedeemJob> {
  const baseUrl = requireBackendUrl();
  return requestJson<RedeemJob>(`${baseUrl}/redeem/${jobId}`, {
    credentials: "include",
  });
}

export async function getLatestRedeemJob(): Promise<RedeemJob> {
  const baseUrl = requireBackendUrl();
  return requestJson<RedeemJob>(`${baseUrl}/redeem/latest`, {
    credentials: "include",
  });
}

export async function recheckRedeemItem(
  jobId: string,
  itemId: string,
): Promise<{ ok: true }> {
  const baseUrl = requireBackendUrl();
  return requestJson<{ ok: true }>(
    `${baseUrl}/redeem/${jobId}/items/${itemId}/recheck`,
    {
      method: "POST",
      credentials: "include",
    },
  );
}

export async function retryRedeemItem(
  jobId: string,
  itemId: string,
): Promise<{ ok: true }> {
  const baseUrl = requireBackendUrl();
  return requestJson<{ ok: true }>(
    `${baseUrl}/redeem/${jobId}/items/${itemId}/retry`,
    {
      method: "POST",
      credentials: "include",
    },
  );
}

export async function resubmitRedeemItem(
  jobId: string,
  itemId: string,
  accessToken: string,
): Promise<{ ok: true }> {
  const baseUrl = requireBackendUrl();
  return requestJson<{ ok: true }>(
    `${baseUrl}/redeem/${jobId}/items/${itemId}/resubmit`,
    {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ accessToken }),
    },
  );
}

export function subscribeRedeemJob(
  jobId: string,
  onJob: (job: RedeemJob) => void,
  onError: () => void,
) {
  const baseUrl = requireBackendUrl();
  const source = new EventSource(`${baseUrl}/redeem/${jobId}/events`, {
    withCredentials: true,
  });

  source.addEventListener("job", (event) => {
    onJob(JSON.parse((event as MessageEvent).data) as RedeemJob);
  });

  source.onerror = onError;
  return source;
}
