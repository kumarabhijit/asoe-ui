export type Role = "analyst" | "manager" | "admin" | "viewer" | "partner";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: Role[];
  org: string;
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface SSOInitResponse {
  redirectUrl: string;
}
