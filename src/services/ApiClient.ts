export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;
  constructor(code: string, status = 0, traceId?: string) {
    super(code);
    this.code = code;
    this.status = status;
    this.traceId = traceId;
  }
}

type Tokens = { accessToken: string; refreshToken?: string; refreshAvailable?: boolean };
type ClientOptions = {
  baseUrl: string;
  getLaunchToken: () => Promise<string>;
  fetch?: typeof fetch;
};

/** Game-service credentials live for this page session only. */
export class ApiClient {
  private accessToken = '';
  private refreshToken = '';
  private authenticating: Promise<void> | null = null;
  private send: typeof fetch;
  private options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
    this.send = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async login() {
    const launchToken = await this.options.getLaunchToken();
    this.tokens(await this.raw<Tokens>('POST', '/api/v1/auth/exchange', { launchToken }));
  }

  private tokens(tokens: Tokens) {
    if (!tokens.accessToken) throw new ApiError('INVALID_TOKEN_RESPONSE');
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshAvailable ? (tokens.refreshToken ?? '') : '';
  }

  private renew() {
    if (!this.authenticating) {
      this.authenticating = (async () => {
        if (this.refreshToken) {
          try {
            this.tokens(
              await this.raw<Tokens>('POST', '/api/v1/auth/refresh', {
                refreshToken: this.refreshToken,
              }),
            );
            return;
          } catch {
            this.refreshToken = '';
          }
        }
        await this.login();
      })().finally(() => {
        this.authenticating = null;
      });
    }
    return this.authenticating;
  }

  async request<T>(method: string, path: string, body?: unknown, key?: string): Promise<T> {
    const token = this.accessToken;
    try {
      return await this.raw<T>(method, path, body, token, key);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // A concurrent request may already have rotated the credential.
      if (token === this.accessToken) await this.renew();
      return this.raw<T>(method, path, body, this.accessToken, key);
    }
  }

  private async raw<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
    key?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      if (key) headers['Idempotency-Key'] = key;
      const response = await this.send(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
        keepalive: path.endsWith('/finish'),
      });
      const text = await response.text();
      // Preserve int64 seed digits before JavaScript converts numbers to doubles.
      let data = null;
      try {
        data = text
          ? JSON.parse(text.replace(/("seed"\s*:\s*)(-?\d+)(?=\s*[,}])/g, '$1"$2"'))
          : null;
      } catch {
        // Gateways can return HTML errors. Keep the HTTP status for auth/retry handling.
        if (response.ok) throw new ApiError('INVALID_RESPONSE');
      }
      if (!response.ok)
        throw new ApiError(data?.code ?? 'HTTP_ERROR', response.status, data?.traceId);
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'CONNECTION_LOST');
    } finally {
      clearTimeout(timer);
    }
  }
}
