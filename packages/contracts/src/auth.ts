export type UserRole = 'USER' | 'ADMIN';
export interface UserContract { id: string; email: string; role: UserRole; mfaEnabled: boolean; }
export interface AuthTokens { accessToken: string; expiresIn: number; }
export interface AuthUser { user: UserContract; tokens: AuthTokens; }
