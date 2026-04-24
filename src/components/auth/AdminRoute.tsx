// Hard gate for /admin — only admins get through. Everyone else is bounced
// home with a toast so we never leak the surface to curious snoopers.
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking admin…
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/account" replace />;
  return <>{children}</>;
};

export default AdminRoute;
