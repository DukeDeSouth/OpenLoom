export type ErrorCode = "DB_UNREACHABLE" | "UNAUTHORIZED" | "INTERNAL" | "NETWORK" | "UNKNOWN";

export class ApiError extends Error {
  code: ErrorCode;
  hint?: string;
  status: number;

  constructor(message: string, code: ErrorCode, status: number, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

export async function fetchJSON<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(
      "Could not connect to the server. Check that OpenLoom is running.",
      "NETWORK",
      0,
    );
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let code: ErrorCode = "UNKNOWN";
    let hint: string | undefined;

    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
      if (data?.code) code = data.code;
      if (data?.hint) hint = data.hint;
    } catch {
      // non-JSON body
    }

    if (res.status === 401) {
      code = "UNAUTHORIZED";
      if (!hint) hint = "Your session may have expired. Try signing in again.";
    }

    throw new ApiError(msg, code, res.status, hint);
  }

  return res.json();
}
