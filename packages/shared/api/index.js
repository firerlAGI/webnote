export class ApiClient {
    constructor(baseUrl = '/api') {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "token", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.baseUrl = baseUrl;
        this.loadToken();
    }
    loadToken() {
        if (typeof localStorage !== 'undefined') {
            this.token = localStorage.getItem('token');
        }
    }
    saveToken(token) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('token', token);
        }
        this.token = token;
    }
    removeToken() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
        }
        this.token = null;
    }
    buildUrl(url, params) {
        const base = this.baseUrl + url;
        if (!params)
            return base;
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        return `${base}?${queryString}`;
    }
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    async handleResponse(response) {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'API Error');
        }
        return {
            success: true,
            data: data,
            code: response.status
        };
    }
    async request(method, url, body, params) {
        const options = {
            method,
            headers: this.buildHeaders(),
            body: body ? JSON.stringify(body) : undefined
        };
        const fullUrl = this.buildUrl(url, params);
        const response = await fetch(fullUrl, options);
        return this.handleResponse(response);
    }
    async get(url, params) {
        return this.request('GET', url, undefined, params);
    }
    async post(url, body, params) {
        return this.request('POST', url, body, params);
    }
    async put(url, body, params) {
        return this.request('PUT', url, body, params);
    }
    async patch(url, body, params) {
        return this.request('PATCH', url, body, params);
    }
    async delete(url, params) {
        return this.request('DELETE', url, undefined, params);
    }
    async login(email, password) {
        const response = await this.post('/auth/login', { email, password });
        if (response.success) {
            this.saveToken(response.data.token);
        }
        return response;
    }
    async logout() {
        this.removeToken();
    }
}
export default new ApiClient();
