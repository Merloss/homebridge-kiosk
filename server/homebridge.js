const DEFAULT_TOKEN_TTL_S = 8 * 60 * 60;

const errorText = (res) => res.text().then((body) => body.slice(0, 200), () => '');

export class HomebridgeClient {
  #token = null;
  #tokenExpiresAt = 0;
  #pendingLogin = null;

  constructor({ url, username, password }) {
    this.url = url;
    this.username = username;
    this.password = password;
  }

  getAccessories() {
    return this.#request('/api/accessories');
  }

  async getLayout() {
    try {
      return await this.#request('/api/accessories/layout');
    } catch {
      return [];
    }
  }

  setCharacteristic(uniqueId, characteristicType, value) {
    return this.#request(`/api/accessories/${encodeURIComponent(uniqueId)}`, {
      method: 'PUT',
      body: JSON.stringify({ characteristicType, value }),
    });
  }

  async #request(path, options = {}, retryOnUnauthorized = true) {
    const res = await fetch(`${this.url}${path}`, {
      ...options,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${await this.#getToken()}`,
      },
    });

    if (res.status === 401 && retryOnUnauthorized) {
      this.#token = null;
      return this.#request(path, options, false);
    }
    if (!res.ok) throw new Error(`Homebridge ${path} returned ${res.status}: ${await errorText(res)}`);
    return res.status === 204 ? null : res.json();
  }

  #getToken() {
    if (this.#token && Date.now() < this.#tokenExpiresAt) return this.#token;
    this.#pendingLogin ??= this.#login().finally(() => {
      this.#pendingLogin = null;
    });
    return this.#pendingLogin;
  }

  async #login() {
    const res = await fetch(`${this.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!res.ok) throw new Error(`Homebridge login failed (${res.status}): ${await errorText(res)}`);

    const { access_token: token, expires_in: ttl } = await res.json();
    this.#token = token;
    this.#tokenExpiresAt = Date.now() + ((Number(ttl) || DEFAULT_TOKEN_TTL_S) - 60) * 1000;
    return token;
  }
}
