import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import SharedReport from "./pages/SharedReport";
import Compare from "./pages/Compare";
import NotFound from "./pages/NotFound";
import { useEffect, useRef } from "react";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "hsl(234, 56%, 60%)",
    colorForeground: "hsl(220, 13%, 9%)",
    colorMutedForeground: "hsl(220, 9%, 46%)",
    colorDanger: "hsl(0, 72%, 51%)",
    colorBackground: "hsl(210, 11%, 97%)",
    colorInput: "hsl(218, 14%, 89%)",
    colorInputForeground: "hsl(220, 13%, 9%)",
    colorNeutral: "hsl(218, 14%, 89%)",
    fontFamily: "'Inter var', Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-xl border border-border/70 bg-card/60 w-[440px] max-w-full overflow-hidden shadow-2xl shadow-primary/5 backdrop-blur",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-display text-xl font-medium tracking-tight text-foreground",
    headerSubtitle: "text-[13px] text-muted-foreground",
    socialButtonsBlockButtonText: "text-[13px] font-medium text-foreground",
    formFieldLabel: "text-[13px] font-medium text-foreground",
    footerActionLink: "text-primary hover:underline text-[13px]",
    footerActionText: "text-[13px] text-muted-foreground",
    dividerText: "text-[11px] uppercase tracking-wider text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600 text-[12px]",
    alertText: "text-[13px]",
    logoBox: "hidden",
    socialButtonsBlockButton: "border border-border/70 bg-background hover:bg-card h-10 rounded-md text-[13px]",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md text-[13px] font-medium",
    formFieldInput: "border border-border/70 bg-background text-foreground rounded-md text-[13px] h-10",
    footerAction: "px-6 py-4",
    dividerLine: "bg-border/60",
    alert: "rounded-md",
    otpCodeFieldInput: "border border-border/70 rounded-md",
    formFieldRow: "mb-3",
    main: "p-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = queryClient;
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/r/:slug" component={SharedReport} />
      <Route path="/analyze">
        <ProtectedRoute><Analyze /></ProtectedRoute>
      </Route>
      <Route path="/results">
        <ProtectedRoute><Results /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/compare">
        <ProtectedRoute><Compare /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your Concept AI account" } },
        signUp: { start: { title: "Create your account", subtitle: "Start analyzing your ideas with AI" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryCacheInvalidator />
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="concept-ai-theme">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
