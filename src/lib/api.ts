import type { AuthUser, LoginCredentials, LoginResponse, SSOInitResponse } from "@/types/auth";
import { ROLE_PERMISSIONS } from "./roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Mock data for development (no FastAPI needed) ──────────────────── */
const MOCK_USER: AuthUser = {
  id: "usr_001",
  email: "jane.doe@acme.com",
  name: "Jane Doe",
  roles: ["analyst", "manager"],
  org: "acme-corp",
  permissions: ROLE_PERMISSIONS.manager,
};

const MOCK_DELAY = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Auth API ───────────────────────────────────────────────────────── */
export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // In production: POST to FastAPI /api/auth/login
    // For now: mock validation
    await delay(MOCK_DELAY);

    if (
      credentials.email === "jane@acme.com" &&
      credentials.password === "password"
    ) {
      return {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        user: MOCK_USER,
      };
    }

    throw new Error("Invalid email or password");
  },

  async ssoInit(provider?: string): Promise<SSOInitResponse> {
    // In production: POST to FastAPI /api/auth/sso/init
    await delay(MOCK_DELAY);
    return {
      redirectUrl: `${API_URL}/api/auth/sso/redirect?provider=${provider || "default"}`,
    };
  },

  async me(token: string): Promise<AuthUser> {
    // In production: GET from FastAPI /api/auth/me
    await delay(300);
    if (token) return MOCK_USER;
    throw new Error("Unauthorized");
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    // In production: POST to FastAPI /api/auth/refresh
    await delay(200);
    if (refreshToken) return { accessToken: "mock-refreshed-token" };
    throw new Error("Invalid refresh token");
  },
};
