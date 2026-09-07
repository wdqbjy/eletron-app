export interface User {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    role: string;
    createdAt: string;
}
export interface LoginParams {
    username: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: User;
}
export declare const userApi: {
    getSystemCode: () => Promise<any>;
    login: (params: LoginParams) => Promise<LoginResponse>;
    getCurrentUser: () => Promise<User>;
    updateUser: (id: number, data: Partial<User>) => Promise<User>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
    uploadAvatar: (filePath: string) => Promise<{
        url: string;
    }>;
    getUserList: (params?: {
        page: number;
        pageSize: number;
    }) => Promise<{
        list: User[];
        total: number;
    }>;
};
