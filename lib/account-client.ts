import {
  UPSTREAM_API_BASE_URL,
  documentedUpstreamEndpoints,
} from "./contracts";
import { requestJson } from "./http-client";

export type AccountCheckResponse = Record<string, unknown>;
export type SubscriptionResponse = Record<string, unknown> & {
  plan_type?: string;
  status?: string;
  ok?: boolean;
  reason?: string;
  message?: string;
  subscription_plan?: string;
  has_active_subscription?: boolean;
  billing_period?: string;
  billing_currency?: string;
  expires_at?: string;
  renews_at?: string;
  days_left?: number;
  will_renew?: boolean;
  is_delinquent?: boolean;
  purchase_origin_platform?: string;
  eligible_offers?: string[];
  applied_discounts?: Array<Record<string, unknown>>;
};

export function checkAccount(token: string, promoId?: string, signal?: AbortSignal) {
  return requestJson<AccountCheckResponse>(
    `${UPSTREAM_API_BASE_URL}${documentedUpstreamEndpoints.check}`,
    {
      method: "POST",
      body: JSON.stringify({
        token,
        ...(promoId ? { promoId } : {}),
      }),
      signal,
    },
  );
}

export function querySubscription(token: string, signal?: AbortSignal) {
  return requestJson<SubscriptionResponse>(
    `${UPSTREAM_API_BASE_URL}${documentedUpstreamEndpoints.subscription}`,
    {
      method: "POST",
      body: JSON.stringify({ token }),
      signal,
    },
  );
}
