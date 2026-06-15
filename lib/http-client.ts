export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error &&
      error.message.toLowerCase().includes("aborted"))
  );
}

export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string; code?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      body?.code,
    );
  }

  return body as T;
}
