export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(0, 'Network error. Please check your connection and try again.');
  }

  if (res.redirected) {
    throw new ApiError(401, 'Your session has expired or you lack permission.');
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const fieldErrors =
      body !== null &&
      typeof body === 'object' &&
      body.details !== null &&
      typeof body.details === 'object' &&
      !Array.isArray(body.details)
        ? (body.details as Record<string, string>)
        : undefined;
    const message =
      typeof body?.error === 'string' ? body.error : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message, fieldErrors);
  }

  return body as T;
}
