// lib/auth.ts - Updated signIn callback
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  providers: [
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

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ── signIn ───────────────────────────────────────────────────────────
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;

      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { 
            accounts: { where: { provider: 'google' } },
          },
        });

        if (existingUser) {
          const hasGoogleAccount = existingUser.accounts.length > 0;

          if (!existingUser.isActive) {
            // User exists but is inactive - allow sign-in but they'll be redirected to pending activation
            console.log('[NextAuth] User exists but is inactive. Allowing sign-in with pending activation.');
            return true;
          }

          if (!hasGoogleAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
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
        }

        // ── Brand-new Google user ──
        const newUser = await prisma.user.create({
          data: {
            email: user.email!,
            name: user.name ?? 'New User',
            password: null,
            role: 'CLIENT',
            isActive: false,
            emailVerified: new Date(),
          },
        });

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

        console.log('[NextAuth] ✅ New user created (inactive). Allowing sign-in...');
        return true;
      } catch (error) {
        console.error('[NextAuth] Google signIn error:', error);
        return true;
      }
    },

    // ── jwt ──────────────────────────────────────────────────────────────
    async jwt({ token, user, account, trigger }) {
      if (user) {
        if (account?.provider === 'google') {
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
          } else {
            token.id = (user as any).id;
          }
        } else {
          token.id = (user as any).id;
          token.role = (user as any).role;
          token.tenantId = (user as any).tenantId;
          token.tenant = (user as any).tenant;
          token.subscriptionStatus = (user as any).subscriptionStatus;
          token.isActive = (user as any).isActive;
          token.phone = (user as any).phone;
        }
      } else if (trigger === 'update' && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { tenant: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId ?? undefined;
          token.tenant = dbUser.tenant as any;
          token.subscriptionStatus = dbUser.tenant?.subscriptionStatus ?? 'inactive';
          token.isActive = dbUser.isActive;
        }
      }

      return token;
    },

    // ── session ──────────────────────────────────────────────────────────
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

    // ── redirect ─────────────────────────────────────────────────────────
    async redirect({ url, baseUrl }) {
      // If the URL has a callbackUrl parameter, extract it
      const callbackUrl = new URL(url, baseUrl).searchParams.get('callbackUrl');
      
      // If there's a callback URL and it's the dashboard, redirect to pending activation instead
      if (callbackUrl && callbackUrl.includes('/client/dashboard')) {
        // Check if the user is inactive by fetching the session
        // We can't access session here, so we'll handle this in the page itself
        // Instead, just return the callback URL and let the page handle the redirect
        return callbackUrl;
      }

      if (url.includes('/login?error=')) {
        return url.startsWith('http') ? url : `${baseUrl}${url}`;
      }
      
      if (url.includes('/api/auth/callback')) return url;
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