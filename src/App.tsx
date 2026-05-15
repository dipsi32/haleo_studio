import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import ProposalIntelligencePage from "./pages/ProposalIntelligencePage.tsx";
import ProposalsCompare from "./pages/ProposalsCompare.tsx";
import ContractorSubmit from "./pages/ContractorSubmit.tsx";
import ProLanding from "./pages/pro/ProLanding.tsx";
import ProLogin from "./pages/pro/ProLogin.tsx";
import ProOnboarding from "./pages/pro/ProOnboarding.tsx";
import ProInbox from "./pages/pro/ProInbox.tsx";
import ProStudio from "./pages/pro/ProStudio.tsx";
import PublicContractorProfile from "./pages/pro/PublicContractorProfile.tsx";
import ClaimProfile from "./pages/pro/ClaimProfile.tsx";
import ContractorRoute from "./components/auth/ContractorRoute.tsx";
import HomeownerNotificationToaster from "./components/HomeownerNotificationToaster.tsx";
import ContractorNotificationToaster from "./components/ContractorNotificationToaster.tsx";

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
          <HomeownerNotificationToaster />
          <ContractorNotificationToaster />
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
            <Route path="/audit" element={<Navigate to="/proposal" replace />} />
            <Route path="/proposal" element={<ProposalIntelligencePage />} />
            <Route path="/proposal/:reportId" element={<ProposalIntelligencePage />} />
            <Route
              path="/account/proposals/compare"
              element={
                <ProtectedRoute>
                  <ProposalsCompare />
                </ProtectedRoute>
              }
            />
            <Route path="/contractor/submit/:outreachSendId" element={<ContractorSubmit />} />

            {/* Pro Workspace (contractor-side) */}
            <Route path="/pro" element={<ProLanding />} />
            <Route path="/pro/login" element={<ProLogin />} />
            {/* Public profile + claim flow — no auth required */}
            <Route path="/pro/:slug" element={<PublicContractorProfile />} />
            <Route path="/pro/:slug/claim" element={<ClaimProfile />} />
            <Route
              path="/pro/onboarding"
              element={
                <ProtectedRoute>
                  <ProOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pro/profile"
              element={
                <ContractorRoute>
                  <ProStudio />
                </ContractorRoute>
              }
            />
            <Route
              path="/pro/inbox"
              element={
                <ContractorRoute>
                  <ProInbox />
                </ContractorRoute>
              }
            />


            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
