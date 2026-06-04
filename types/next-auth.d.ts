import { DefaultSession, DefaultUser } from "next-auth";
import { Tenant } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId?: string;
      tenant?: Tenant;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    tenantId?: string;
    tenant?: Tenant;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId?: string;
    tenant?: Tenant;
  }
}