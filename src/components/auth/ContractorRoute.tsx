// Gate for /pro/* — only contractors get through. Forces onboarding if incomplete.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useContractorAccount } from "@/hooks/useContractorAccount";

const ContractorRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isContractor, account, loading } = useContractorAccount();
  const location = useLocation();

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Opening your workspace…
      </div>
    );
  }

  if (!user) return <Navigate to={`/pro/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isContractor) return <Navigate to="/pro/login?error=not_contractor" replace />;

  // Force onboarding if not complete
  if (!account?.onboarded_at && location.pathname !== "/pro/onboarding") {
    return <Navigate to="/pro/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ContractorRoute;
