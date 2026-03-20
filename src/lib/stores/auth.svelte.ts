import { MacroFactorClient } from '$lib/api';

const STORAGE_KEY = 'mf_refresh_token';

class AuthState {
  client = $state<MacroFactorClient | null>(null);
  loading = $state(true);
  error = $state<string | null>(null);

  get isAuthenticated(): boolean {
    return this.client !== null;
  }

  async login(email: string, password: string): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.client = await MacroFactorClient.login(email, password);
      localStorage.setItem(STORAGE_KEY, this.client.getRefreshToken());
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Login failed';
      throw e;
    } finally {
      this.loading = false;
    }
  }

  async restore(): Promise<void> {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      this.loading = false;
      return;
    }
    try {
      this.client = await MacroFactorClient.fromRefreshToken(token);
      localStorage.setItem(STORAGE_KEY, this.client.getRefreshToken());
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      this.loading = false;
    }
  }

  logout(): void {
    this.client = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const auth = new AuthState();
