import { createContext, useContext } from "react";
import { useUser, useClerk } from "@clerk/react";

interface AuthCtx {
  user: { id: string; email?: string; displayName?: string } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const authUser = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        displayName:
          user.fullName ||
          user.firstName ||
          user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
          "User",
      }
    : null;

  return (
    <Ctx.Provider value={{ user: authUser, loading: !isLoaded, signOut: clerkSignOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
