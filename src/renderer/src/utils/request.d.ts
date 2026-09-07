export interface RequestConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
}
export declare class ApiError extends Error {
    statusCode: number;
    message: string;
    data?: any | undefined;
    constructor(statusCode: number, message: string, data?: any | undefined);
}
declare class HttpClient {
    private baseURL;
    private defaultHeaders;
    constructor(config?: RequestConfig);
    private getFullURL;
    get<T = any>(url: string, params?: any): Promise<T>;
    post<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<T>;
    put<T = any>(url: string, data?: any): Promise<T>;
    delete<T = any>(url: string): Promise<T>;
    patch<T = any>(url: string, data?: any): Promise<T>;
    uploadFile<T = any>(url: string, filePath: string, fieldName?: string, data?: any): Promise<T>;
}
export declare const httpClient: HttpClient;
export default httpClient;
