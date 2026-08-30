import crypto from "crypto";
import { HandoffTokenPayload, HandoffTokenPort } from "../../core/ports/HandoffPort";
import { OperationFailure } from "../../core/types/errors";

export class HmacHandoffTokenAdapter implements HandoffTokenPort {
  constructor(private readonly secret: string | undefined) {}

  issue(payload: HandoffTokenPayload): string {
    if (!this.secret) throw new OperationFailure({
      code: "HANDOFF_NOT_CONFIGURED",
      category: "authorization",
      message: "A integração OpenGym não está configurada.",
      retryable: false
    });
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", this.secret).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }
}
