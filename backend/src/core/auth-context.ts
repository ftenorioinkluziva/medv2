import { UserRole } from "./schemas/backoffice";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
  role: UserRole;
};
