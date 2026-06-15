import { BACKEND_API_BASE_URL, type RedeemRecord } from "./contracts";
import { requestJson } from "./http-client";

export class RecordsBackendUnavailableError extends Error {
  constructor() {
    super("兑换记录后端尚未接入，请配置 NEXT_PUBLIC_BACKEND_API_BASE_URL。");
    this.name = "RecordsBackendUnavailableError";
  }
}

export function listRedeemRecords(signal?: AbortSignal) {
  if (!BACKEND_API_BASE_URL) throw new RecordsBackendUnavailableError();

  return requestJson<{ records: RedeemRecord[] }>(
    `${BACKEND_API_BASE_URL}/redeem/records`,
    {
      credentials: "include",
      signal,
    },
  );
}
