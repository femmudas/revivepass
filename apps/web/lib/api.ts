const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const devFallbackApiBase = process.env.NODE_ENV === "development" ? "http://localhost:4000" : "";
const API_BASE = (configuredApiBase || devFallbackApiBase).replace(/\/$/, "");

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  formData?: FormData;
};

const buildUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: HeadersInit = {};
  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as {
      message?: unknown;
      error?: unknown;
    };

    const pickMessage = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (typeof obj.message === "string") return obj.message;
        if (typeof obj.error === "string") return obj.error;
        if (obj.fieldErrors && typeof obj.fieldErrors === "object") {
          const fields = obj.fieldErrors as Record<string, unknown>;
          for (const field of Object.keys(fields)) {
            const candidate = fields[field];
            if (Array.isArray(candidate) && typeof candidate[0] === "string") {
              return `${field}: ${candidate[0]}`;
            }
          }
        }
      }
      return null;
    };

    const message =
      pickMessage(payload.message) ??
      pickMessage(payload.error) ??
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
};

export const apiBaseUrl = API_BASE || "(same-origin)";
