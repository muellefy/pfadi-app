import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google login, restricted to one Google Workspace domain (default: pfadis.ch).
 *
 * We request Drive access so the app reads the camp files *as the logged-in user*.
 * That way the app never sees more than the person could already open in Drive —
 * TN lists with sensitive data stay protected by your existing Drive sharing.
 */
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN ?? "pfadis.ch").toLowerCase();

const SCOPES = [
  "openid",
  "email",
  "profile",
  // full drive scope is needed for writing back (e.g. ticking off a Termin).
  // Use drive.readonly if you set "writeBack": false for all camps.
  process.env.GOOGLE_DRIVE_SCOPE ?? "https://www.googleapis.com/auth/drive",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

type GoogleToken = {
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
  error?: "RefreshTokenError";
};

async function refresh(token: GoogleToken): Promise<GoogleToken> {
  if (!token.refresh_token) return { ...token, error: "RefreshTokenError" };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ...token, error: "RefreshTokenError" };
  return {
    ...token,
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
    refresh_token: data.refresh_token ?? token.refresh_token,
    error: undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      authorization: {
        params: {
          scope: SCOPES,
          hd: ALLOWED_DOMAIN, // pre-selects the right account in Google's picker
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // `hd` in the URL is only a hint — the real check happens here.
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile) return false;
      const email = (profile.email ?? "").toLowerCase();
      const hd = String((profile as Record<string, unknown>).hd ?? "").toLowerCase();
      return Boolean(profile.email_verified) && hd === ALLOWED_DOMAIN && email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    async jwt({ token, account }) {
      const t = token as typeof token & GoogleToken;
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        };
      }
      if (t.expires_at && Date.now() < (t.expires_at - 60) * 1000) return token;
      return { ...token, ...(await refresh(t)) };
    },
    async session({ session, token }) {
      const t = token as typeof token & GoogleToken;
      session.accessToken = t.access_token;
      session.error = t.error;
      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
