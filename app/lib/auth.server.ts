import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { sessionStorage } from "./session.server";
import { prisma } from "./prisma.server";
import bcrypt from "bcryptjs";
// Remove the User, Role import - we don't need them

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: {
    id: string;
    name: string;
  };
};

export const authenticator = new Authenticator<AuthUser>(sessionStorage);

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
    };
  }),
  "form"
);

// Helper function to get user from session
export async function requireAuth(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const user = session.get("user");
  
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  
  return user as AuthUser;
}

// Helper function to get user from session (returns null if not authenticated)
export async function getUser(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return session.get("user") as AuthUser | null;
}
