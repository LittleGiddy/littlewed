import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// ─── We intentionally do NOT add `adapter: PrismaAdapter(prisma)` ──────────
// Using a database adapter with CredentialsProvider + JWT strategy caused a
// redirect loop. With JWT strategy, NextAuth stores everything encrypted in
// the cookie – no adapter needed.
// ────────────────────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    // ── Credentials (email/password) ──────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: user.role,
          tenantId: user.tenantId ?? undefined,
          tenant: user.tenant,
          subscriptionStatus: user.tenant?.subscriptionStatus ?? 'inactive',
          isActive: user.isActive,
          phone: user.phone ?? undefined,
        } as any;
      },
    }),

    // ── Google OAuth ──────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ── signIn ────────────────────────────────────────────────────────────────
    async signIn({ user, account }) {
      // Only apply custom logic for Google sign‑in
      if (account?.provider === 'google') {
        try {
          // Check if a user with this email already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: {
              accounts: {
                where: { provider: 'google' },
                select: { provider: true },
              },
            },
          });

          if (existingUser) {
            // User exists → check if they already have a Google account linked
            const hasGoogleAccount = existingUser.accounts.length > 0;

            if (hasGoogleAccount) {
              // ✅ They have a Google link → allow sign‑in
              return true;
            }

            // No Google link → check if they have a password (email/password signup)
            if (existingUser.password) {
              // ❌ This is an email/password account → block Google sign‑in
              return false;
            }

            // User exists with no password and no Google link
            return true;
          }

          // ── First‑time Google user ──
          // ✅ Create user WITHOUT a tenant
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name ?? 'New User',
              password: null,
              role: 'CLIENT',
              isActive: true, // ✅ Auto-activate so they can sign in
              emailVerified: new Date(),
              // ✅ No tenantId set here - they'll create one during sign-in flow
            },
          });

          // Create an Account record to link the Google provider
          if (newUser) {
            await prisma.account.create({
              data: {
                userId: newUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          return true;
        } catch (err) {
          console.error('[NextAuth] Google signIn error:', err);
          return false;
        }
      }

      // For other providers (credentials), always allow
      return true;
    },

    // ── jwt ────────────────────────────────────────────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          // Google sign‑in: fetch our DB record to get role, tenantId, isActive, etc.
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            include: { tenant: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.tenantId = dbUser.tenantId ?? undefined;
            token.tenant = dbUser.tenant as any;
            token.subscriptionStatus = dbUser.tenant?.subscriptionStatus ?? 'inactive';
            token.isActive = dbUser.isActive;
            token.phone = dbUser.phone ?? undefined;
          }
        } else {
          // Credentials — everything is already on the user object from authorize()
          token.id = (user as any).id;
          token.role = (user as any).role;
          token.tenantId = (user as any).tenantId;
          token.tenant = (user as any).tenant;
          token.subscriptionStatus = (user as any).subscriptionStatus;
          token.isActive = (user as any).isActive;
          token.phone = (user as any).phone;
        }
      }
      return token;
    },

    // ── session ────────────────────────────────────────────────────────────────
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenant = token.tenant;
        (session.user as any).subscriptionStatus = token.subscriptionStatus;
        (session.user as any).isActive = token.isActive;
        (session.user as any).phone = token.phone;
      }
      return session;
    },

    // ── redirect ──────────────────────────────────────────────────────────────
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};