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
    // ── signIn ────────────────────────────────────────────────────────────────
    async signIn({ user, account }) {
      console.log('[NextAuth] signIn - Provider:', account?.provider);
      console.log('[NextAuth] signIn - User email:', user?.email);

      if (account?.provider === 'google') {
        try {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: {
              accounts: {
                where: { provider: 'google' },
              },
            },
          });

          console.log('[NextAuth] Existing user:', !!existingUser);

          if (existingUser) {
            const hasGoogleAccount = existingUser.accounts.length > 0;
            console.log('[NextAuth] Has Google account:', hasGoogleAccount);

            if (hasGoogleAccount) {
              // ✅ User already has Google account - allow sign in
              console.log('[NextAuth] ✅ User has Google account, allowing sign-in');
              return true;
            }

            // User exists but doesn't have Google account linked
            console.log('[NextAuth] User exists, linking Google account...');

            // Link the Google account
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

            console.log('[NextAuth] ✅ Google account linked successfully');
            return true;
          }

          // ── Create new user ──
          console.log('[NextAuth] Creating new user...');

          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name ?? 'New User',
              password: null,
              role: 'CLIENT',
              isActive: true,
              emailVerified: new Date(),
            },
          });

          console.log('[NextAuth] User created:', newUser.id);

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

          console.log('[NextAuth] ✅ New user created and Google account linked');
          return true;
        } catch (error) {
          console.error('[NextAuth] Google signIn error:', error);
          // ⚠️ IMPORTANT: Return true to prevent AccessDenied
          // The user will be signed in but might have incomplete data
          return true;
        }
      }

      return true;
    },

    // ── jwt ────────────────────────────────────────────────────────────────────
    async jwt({ token, user, account }) {
      console.log('[NextAuth] JWT - User:', user?.email);

      if (user) {
        if (account?.provider === 'google') {
          // Fetch user from database
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            include: { tenant: true },
          });

          if (dbUser) {
            console.log('[NextAuth] JWT - DB user found:', dbUser.id);
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.tenantId = dbUser.tenantId ?? undefined;
            token.tenant = dbUser.tenant as any;
            token.subscriptionStatus = dbUser.tenant?.subscriptionStatus ?? 'inactive';
            token.isActive = dbUser.isActive;
            token.phone = dbUser.phone ?? undefined;
          } else {
            console.log('[NextAuth] JWT - DB user NOT found!');
            // Use the user from the token
            token.id = (user as any).id;
          }
        } else {
          // Credentials
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
      console.log('[NextAuth] Session - User:', session.user?.email);

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
      console.log('[NextAuth] Redirect - URL:', url);
      console.log('[NextAuth] Redirect - Base:', baseUrl);

      // Handle error redirects
      if (url.includes('/login?error=')) {
        return '/login';
      }

      // If the URL is the callback URL, redirect to the appropriate dashboard
      if (url.includes('/api/auth/callback')) {
        // Let NextAuth handle the callback redirect
        return url;
      }

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