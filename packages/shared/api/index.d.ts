export declare class ApiClient {
    private baseUrl;
    private token;
    constructor(baseUrl?: string);
    private loadToken;
    private saveToken;
    private removeToken;
    private buildUrl;
    private buildHeaders;
    private handleResponse;
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: any, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    get<T>(url: string, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    post<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    put<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    patch<T>(url: string, body?: any, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    delete<T>(url: string, params?: Record<string, any>): Promise<{
        success: boolean;
        data: T;
        message?: string;
        code: number;
    }>;
    login(email: string, password: string): Promise<{
        success: boolean;
        data: {
            user: any;
            token: string;
        };
        message?: string;
        code: number;
    }>;
    logout(): Promise<void>;
}
declare const _default: ApiClient;
export default _default;
