// Sending a real brief needs an account. The contractor demo's send step
// writes nothing, so it skips the sign-in wall.
import { useParams } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { isDemoToken } from "@/lib/invites";

export default function InviteSendRoute({ children }: { children: React.ReactNode }) {
  const { token } = useParams<{ token: string }>();
  if (isDemoToken(token)) return <>{children}</>;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
