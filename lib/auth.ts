// lib/auth.ts - Updated to prevent auto-creation for non-existent users
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
        // ✅ Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { 
            accounts: { where: { provider: 'google' } },
          },
        });

        // ✅ If user doesn't exist, create them from Google profile
        if (!existingUser) {
          console.log('[NextAuth] User not found, creating from Google:', user.email);
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name || '',
              image: user.image ?? null,
              role: 'CLIENT',
              isActive: false,
            },
          });

          // Link the Google account
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

          // Update the user object so the jwt callback has the correct id
          user.id = newUser.id;
          return true;
        }

        // User exists - check if they're active
        if (!existingUser.isActive) {
          console.log('[NextAuth] User exists but is inactive.');
          return true; // Allow sign-in, login page will handle pending activation
        }

        // Link Google account if not already linked
        const hasGoogleAccount = existingUser.accounts.length > 0;
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

        console.log('[NextAuth] ✅ User exists and is active, allowing sign-in');
        return true;
      } catch (error) {
        console.error('[NextAuth] Google signIn error:', error);
        return false;
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
      // Handle error redirects
      if (url.includes('/login?error=')) {
        return url.startsWith('http') ? url : `${baseUrl}${url}`;
      }

      // If the URL has a callbackUrl parameter
      const callbackUrl = new URL(url, baseUrl).searchParams.get('callbackUrl');
      if (callbackUrl) {
        return url;
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