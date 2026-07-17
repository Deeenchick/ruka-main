import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuthContext();
  if (loading) return <CenteredSpinner />;
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CenteredSpinner() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Загрузка…
    </div>
  );
}
