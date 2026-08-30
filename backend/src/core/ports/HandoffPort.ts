import { HandoffGrant } from "../schemas/handoff";

export interface HandoffTokenPayload {
  iss: "medv0";
  aud: "opengym";
  sub: string;
  name: string;
  contractId: string;
  nonce: string;
  scopes: string[];
  iat: number;
  exp: number;
}

export interface HandoffTokenPort {
  issue(payload: HandoffTokenPayload): string;
}

export interface HandoffGrantPort {
  save(userId: string, grant: HandoffGrant): Promise<void>;
  authorize(contractId: string, subject: string, now: Date): Promise<{ userId: string } | null>;
}
