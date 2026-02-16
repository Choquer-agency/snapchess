const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
    };

    if (this.accessToken) {
      (config.headers as Record<string, string>)['Authorization'] =
        `Bearer ${this.accessToken}`;
    }

    if (body) {
      config.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, config);

    if (res.status === 401 && this.accessToken) {
      // Try to refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        (config.headers as Record<string, string>)['Authorization'] =
          `Bearer ${this.accessToken}`;
        const retryRes = await fetch(`${API_BASE}${endpoint}`, config);
        return retryRes.json();
      }
    }

    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        this.accessToken = data.data.accessToken;
        return true;
      }
    } catch {
      // Refresh failed
    }
    this.accessToken = null;
    return false;
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
  }

  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Analysis
  async saveAnalysis(fen: string, topMoves: unknown[]) {
    return this.request('/analysis', {
      method: 'POST',
      body: { fen, topMoves },
    });
  }

  async getAnalysis(id: string) {
    return this.request(`/analysis/${id}`);
  }

  async getHistory(page = 1) {
    return this.request(`/analysis?page=${page}`);
  }

  // Usage
  async getUsage() {
    return this.request('/usage/today');
  }
}

export const api = new ApiClient();
