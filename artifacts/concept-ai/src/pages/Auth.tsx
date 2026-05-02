import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

const AuthPage = () => {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation("/analyze");
    else if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  return null;
};

export default AuthPage;
