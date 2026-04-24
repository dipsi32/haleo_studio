import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AccessGate from "@/components/auth/AccessGate";
import AdminRoute from "@/components/auth/AdminRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Brief from "./pages/Brief.tsx";
import BriefResult from "./pages/BriefResult.tsx";
import Audit from "./pages/Audit.tsx";
import Contractors from "./pages/Contractors.tsx";
import ContractorProfile from "./pages/ContractorProfile.tsx";
import Login from "./pages/Login.tsx";
import Waitlist from "./pages/Waitlist.tsx";
import Account from "./pages/Account.tsx";
import Admin from "./pages/Admin.tsx";

const queryClient = new QueryClient();

// Pages that require login + an active pilot/paid pass (or admin).
const Gated = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AccessGate>{children}</AccessGate>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/waitlist" element={<Waitlist />} />

            {/* Authenticated, but no pilot pass needed */}
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />

            {/* Admin only */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />

            {/* Pilot/paid-gated */}
            <Route path="/brief" element={<Gated><Brief /></Gated>} />
            <Route path="/brief/result" element={<Gated><BriefResult /></Gated>} />
            <Route path="/contractors" element={<Gated><Contractors /></Gated>} />
            <Route path="/contractors/:id" element={<Gated><ContractorProfile /></Gated>} />
            <Route path="/audit" element={<Gated><Audit /></Gated>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
