export const UPSTREAM_API_BASE_URL =
  process.env.NEXT_PUBLIC_UPSTREAM_API_BASE_URL ?? "https://cha.nerver.cc";

export const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const documentedUpstreamEndpoints = {
  check: "/api/v1/check",
  subscription: "/api/v1/subscription",
  checkout: "/api/v1/checkout",
  channels: "/api/v1/channels",
  stats: "/api/v1/stats",
  health: "/healthz",
} as const;

export type RedeemItem = {
  cdk: string;
  accessToken: string;
};

export type CreateRedeemRequest = {
  items: RedeemItem[];
  idempotencyKey: string;
};

export type RedeemJobStatus =
  | "queued"
  | "validating"
  | "processing"
  | "succeeded"
  | "failed";

export type RedeemItemStatus =
  | "queued"
  | "validating_cdk"
  | "cdk_invalid"
  | "submitting_order"
  | "extracting"
  | "awaiting_scan"
  | "scanned"
  | "succeeded"
  | "failed"
  | "expired";

export type RedeemJobItem = {
  id: string;
  cdk: string;
  tokenTail: string;
  status: RedeemItemStatus;
  upstreamOrderId?: string;
  plan?: string;
  message?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type RedeemJob = {
  id: string;
  idempotencyKey: string;
  status: RedeemJobStatus;
  acceptedAt: string;
  updatedAt: string;
  items: RedeemJobItem[];
};

export type CreateRedeemResponse = {
  jobId: string;
  status: RedeemJobStatus;
  acceptedAt: string;
  items: RedeemJobItem[];
};

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  displayName: string;
  email: string;
  password: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export type RedeemRecord = {
  id: string;
  status: RedeemJobStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};
