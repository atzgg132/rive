import "server-only";

import crypto from "node:crypto";
import {
  assertContractsEnabled,
  isLocalEsignDemo,
  RIVE_ESIGN_PROVIDER,
} from "@/utils/contracts";

export type EsignEnvelopeInput = {
  contractId: string;
  versionId: string;
  signers: Array<{
    signerId: string;
    name: string;
    email: string;
    role: "client" | "owner";
    sequence: number;
  }>;
  documentHash: string;
  callbackUrl: string;
};

export type EsignEnvelope = {
  provider: string;
  providerEnvelopeId: string;
  status: "created";
};

export interface EsignProvider {
  readonly name: string;
  createEnvelope(input: EsignEnvelopeInput): Promise<EsignEnvelope>;
  voidEnvelope(providerEnvelopeId: string): Promise<void>;
}

class LocalEsignProvider implements EsignProvider {
  readonly name = "local";

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignEnvelope> {
    void input;
    return {
      provider: this.name,
      providerEnvelopeId: `local_${crypto.randomBytes(18).toString("hex")}`,
      status: "created",
    };
  }

  async voidEnvelope(providerEnvelopeId: string): Promise<void> {
    void providerEnvelopeId;
    return;
  }
}

/**
 * Rive's first-party signing provider. The application owns the signing
 * ceremony, evidence record, and completed artifact; only the two named
 * contract signers participate.
 */
class RiveEsignProvider implements EsignProvider {
  readonly name = RIVE_ESIGN_PROVIDER;

  async createEnvelope(input: EsignEnvelopeInput): Promise<EsignEnvelope> {
    void input;
    return {
      provider: this.name,
      providerEnvelopeId: ["rive", crypto.randomBytes(18).toString("hex")].join("_"),
      status: "created",
    };
  }

  async voidEnvelope(providerEnvelopeId: string): Promise<void> {
    void providerEnvelopeId;
    return;
  }
}

export function getEsignProvider(): EsignProvider {
  assertContractsEnabled();
  if (isLocalEsignDemo()) return new LocalEsignProvider();
  return new RiveEsignProvider();
}
