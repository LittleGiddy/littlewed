import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// ─── DO NOT add `adapter: PrismaAdapter(prisma)` here ───────────────────────
// Mixing a database adapter with CredentialsProvider + strategy:'jwt' causes
// the redirect-to-login loop. With JWT strategy, NextAuth doesn't need an
// adapter — it stores everything encrypted in the cookie.
// ────────────────────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    // ── Credentials ───────────────────────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
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
          id:                 user.id,
          email:              user.email,
          name:               user.name,
          image:              user.image ?? undefined,
          role:               user.role,
          tenantId:           user.tenantId ?? undefined,
          tenant:             user.tenant,
          subscriptionStatus: user.tenant?.subscriptionStatus ?? 'inactive',
          isActive:           user.isActive,
          phone:              user.phone ?? undefined,
        } as any;
      },
    }),

    // ── Google ────────────────────────────────────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ── signIn ─────────────────────────────────────────────────────────────────
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (existing) {
            // Email exists with a password-based account → block Google login
            if (existing.password) return false;
            // Email exists as a Google-only account → allow
            return true;
          }

          // First-time Google user → create account, inactive until admin approves
          await prisma.user.create({
            data: {
              email:         user.email!,
              name:          user.name  ?? 'New User',
              password:      '',           // no password for OAuth users
              role:          'CLIENT',
              isActive:      false,
              emailVerified: new Date(),
            },
          });

          return true;
        } catch (err) {
          console.error('[NextAuth] Google signIn error:', err);
          return false;
        }
      }

      // Credentials — authorize() already validated
      return true;
    },

    // ── jwt ────────────────────────────────────────────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          // Google sign-in: `user` only has id/name/email/image from the provider.
          // Fetch our DB record to get role, tenantId, isActive, etc.
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            include: { tenant: true },
          });

          if (dbUser) {
            token.id                 = dbUser.id;
            token.role               = dbUser.role;
            token.tenantId           = dbUser.tenantId ?? undefined;
            token.tenant             = dbUser.tenant as any;
            token.subscriptionStatus = dbUser.tenant?.subscriptionStatus ?? 'inactive';
            token.isActive           = dbUser.isActive;
            token.phone              = dbUser.phone ?? undefined;
          }
        } else {
          // Credentials — everything is already on the user object from authorize()
          token.id                 = (user as any).id;
          token.role               = (user as any).role;
          token.tenantId           = (user as any).tenantId;
          token.tenant             = (user as any).tenant;
          token.subscriptionStatus = (user as any).subscriptionStatus;
          token.isActive           = (user as any).isActive;
          token.phone              = (user as any).phone;
        }
      }
      return token;
    },

    // ── session ────────────────────────────────────────────────────────────────
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id                 = token.id;
        (session.user as any).role               = token.role;
        (session.user as any).tenantId           = token.tenantId;
        (session.user as any).tenant             = token.tenant;
        (session.user as any).subscriptionStatus = token.subscriptionStatus;
        (session.user as any).isActive           = token.isActive;
        (session.user as any).phone              = token.phone;
      }
      return session;
    },

    // ── redirect ───────────────────────────────────────────────────────────────
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',  // redirect ?error= back to login, not NextAuth's default page
  },

  // ── Cookies ─────────────────────────────────────────────────────────────────
  // Do NOT set `domain` here — it breaks the cookie when switching between
  // the Vercel domain and your custom domain, or between subdomains.
  // NextAuth will automatically scope the cookie to the current host.
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // domain intentionally omitted — let the browser inherit from the host
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};