export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
    this.loadToken()
  }

  private loadToken(): void {
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('token')
    }
  }

  private saveToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', token)
    }
    this.token = token
  }

  private removeToken(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token')
    }
    this.token = null
  }

  private buildUrl(url: string, params?: Record<string, any>): string {
    const base = this.baseUrl + url
    if (!params) return base

    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')

    return `${base}?${queryString}`
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    const data = await response.json()

    if (!response.ok) {
      throw new Error((data as any).message || 'API Error')
    }

    return {
      success: true,
      data: data as T,
      code: response.status
    }
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: any,
    params?: Record<string, any>
  ): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    const options: RequestInit = {
      method,
      headers: this.buildHeaders(),
      body: body ? JSON.stringify(body) : undefined
    }

    const fullUrl = this.buildUrl(url, params)
    const response = await fetch(fullUrl, options)

    return this.handleResponse<T>(response)
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    return this.request<T>('GET', url, undefined, params)
  }

  async post<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    return this.request<T>('POST', url, body, params)
  }

  async put<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    return this.request<T>('PUT', url, body, params)
  }

  async patch<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    return this.request<T>('PATCH', url, body, params)
  }

  async delete<T>(url: string, params?: Record<string, any>): Promise<{
    success: boolean
    data: T
    message?: string
    code: number
  }> {
    return this.request<T>('DELETE', url, undefined, params)
  }

  async login(email: string, password: string): Promise<{
    success: boolean
    data: { user: any; token: string }
    message?: string
    code: number
  }> {
    const response = await this.post<{ user: any; token: string }>('/auth/login', { email, password })
    if (response.success) {
      this.saveToken(response.data.token)
    }
    return response
  }

  async logout(): Promise<void> {
    this.removeToken()
  }
}

export default new ApiClient()