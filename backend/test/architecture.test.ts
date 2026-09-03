import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonDatabaseAdapter } from "../src/adapters/database/JsonDatabaseAdapter";
import { canonicalizeBiomarkerName, parseNumericBiomarkerValue } from "../src/adapters/database/BiomarkerPersistence";
import { OpenRouterAdapter } from "../src/adapters/llm/OpenRouterAdapter";
import { AnalysisLLMResponseSchema } from "../src/core/schemas/analysis";
import { AnnotationUpdateSchema, SettingsUpdateSchema } from "../src/core/schemas/operations";
import { OperationFailure } from "../src/core/types/errors";
import { ProcessDocumentUseCase } from "../src/core/use-cases/ProcessDocumentUseCase";
import { createApp, resolveHost } from "../src/server";

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("public operation schemas reject unknown or oversized input", () => {
  assert.equal(SettingsUpdateSchema.safeParse({ modelAnalysis: "x", unknown: true }).success, false);
  assert.equal(AnnotationUpdateSchema.safeParse({ annotations: "x".repeat(50_001) }).success, false);
  assert.equal(AnalysisLLMResponseSchema.safeParse({ healthStatus: "incompleto" }).success, false);
});

test("structured biomarker persistence normalizes identifiers and numeric values safely", () => {
  assert.equal(canonicalizeBiomarkerName("Anticorpos Antiperoxidase (Anti-TPO)"), "ANTICORPOS_ANTIPEROXIDASE_ANTI_TPO");
  assert.equal(parseNumericBiomarkerValue("1.234,56 mg/dL"), 1234.56);
  assert.equal(parseNumericBiomarkerValue("< 2,0"), 2);
  assert.equal(parseNumericBiomarkerValue("não informado"), null);
});

test("host exposure is allowed only for loopback or an explicit container context", () => {
  assert.equal(resolveHost({ HOST: "127.0.0.1" } as NodeJS.ProcessEnv), "127.0.0.1");
  assert.equal(resolveHost({ HOST: "0.0.0.0", MEDV2_CONTAINER: "true" } as NodeJS.ProcessEnv), "0.0.0.0");
  assert.throws(() => resolveHost({ HOST: "0.0.0.0" } as NodeJS.ProcessEnv), /HOST não seguro/);
});

test("database validates persisted arrays instead of accepting casts", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "medv2-db-test-"));
  try {
    fs.writeFileSync(path.join(directory, "analyses.json"), JSON.stringify([{ id: "invalid" }]));
    const db = new JsonDatabaseAdapter(directory);
    await assert.rejects(() => db.getAnalyses());
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("OpenRouter errors expose stable retry semantics without leaking payloads", async () => {
  const missingCredential = new OpenRouterAdapter({ getOpenRouterApiKey: async () => "" });
  await assert.rejects(
    () => missingCredential.call({ prompt: "sensitive", model: "test/model" }),
    (error: unknown) => error instanceof OperationFailure
      && error.operationError.code === "OPENROUTER_CREDENTIAL_MISSING"
      && error.operationError.retryable === false
  );

  const originalFetch = global.fetch;
  global.fetch = async () => new Response("rate limited", { status: 429 });
  try {
    const rateLimited = new OpenRouterAdapter({ getOpenRouterApiKey: async () => "secret" });
    await assert.rejects(
      () => rateLimited.call({ prompt: "sensitive", model: "test/model" }),
      (error: unknown) => error instanceof OperationFailure
        && error.operationError.code === "OPENROUTER_RATE_LIMITED"
        && error.operationError.retryable === true
        && !error.operationError.message.includes("sensitive")
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("document processing compensates the stored file when persistence fails", async () => {
  let removed = false;
  const parser = {
    parseBioimpedance: async () => ({ ok: true as const, value: {
      dataExame: "2026-08-13", altura: 170, peso: 80, massaMagra: 40, imc: 27,
      inbodyScore: 80, percentualGordura: 20, massaGordura: 16, aguaCorporal: 50,
      proteina: 12, minerais: 4, taxaMetabolicaBasal: 1700, relacaoCinturaQuadril: 0.9,
      nivelGorduraVisceral: 8
    } })
  } as any;
  const db = {
    getProfile: async () => ({ nome: "Paciente", idade: 40 }),
    saveProcessedBioimpedance: async () => { throw new OperationFailure({
      code: "PERSISTENCE_WRITE_FAILED", category: "internal", message: "failed", retryable: false
    }); }
  } as any;
  const files = {
    save: async () => undefined,
    read: async () => Buffer.alloc(0),
    remove: async () => { removed = true; }
  };
  const runtime = {
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    createId: (prefix: string) => `${prefix}_00000000-0000-4000-8000-000000000000`
  };
  const useCase = new ProcessDocumentUseCase(parser, {} as any, db, files, runtime);
  const result = await useCase.execute("test-user", { type: "bioimpedance", originalName: "exam.pdf", contents: Buffer.from("%PDF-") });
  assert.equal(result.ok, false);
  assert.equal(removed, true);
  if (!result.ok) assert.equal(result.error.code, "PERSISTENCE_WRITE_FAILED");
});

test("HTTP adapter returns structured errors and masks secrets", async () => {
  await withServer(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json() as any);
      assert.equal(health.success, true);
      assert.equal(health.db, "connected");

      const unauthenticated = await fetch(`${baseUrl}/api/settings`, { headers: { Origin: "http://127.0.0.1:3000" } });
      const unauthenticatedBody = await unauthenticated.json() as any;
      assert.equal(unauthenticated.status, 401);
      assert.equal(unauthenticatedBody.error.code, "UNAUTHORIZED");

      const invalid = await fetch(`${baseUrl}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://example.invalid" },
        body: JSON.stringify({ idade: "not-a-number" })
      });
      const invalidBody = await invalid.json() as any;
      assert.equal(invalid.status, 403);
      assert.equal(invalidBody.error.code, "ORIGIN_NOT_ALLOWED");

      const oldStaticUpload = await fetch(`${baseUrl}/uploads/does-not-exist.pdf`);
      assert.equal(oldStaticUpload.status, 404);

      const foreignOrigin = await fetch(`${baseUrl}/api/profile`, { headers: { Origin: "https://example.invalid" } });
      assert.equal(foreignOrigin.status, 403);
  });
});

test("Better Auth creates a session and scopes the clinical API to the authenticated user", async () => {
  await withServer(async (baseUrl) => {
    const email = `test-${crypto.randomUUID()}@example.com`;
    const origin = "http://127.0.0.1:3000";
    const signup = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ name: "Teste MedV2", email, password: "StrongPass123!" })
    });
    assert.equal(signup.status, 200);

    const login = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password: "StrongPass123!" })
    });
    assert.equal(login.status, 200);
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
    assert.match(cookie, /^better-auth\.session_token=/);

    const profile = await fetch(`${baseUrl}/api/profile`, { headers: { cookie, Origin: origin } });
    assert.equal(profile.status, 200);
    const body = await profile.json() as any;
    assert.equal(body.profile.nome, "Paciente MedV2");

    const biomarkerHistory = await fetch(`${baseUrl}/api/biomarkers/history`, { headers: { cookie, Origin: origin } });
    assert.equal(biomarkerHistory.status, 200);
    const biomarkerHistoryBody = await biomarkerHistory.json() as any;
    assert.equal(biomarkerHistoryBody.success, true);
    assert.ok(Array.isArray(biomarkerHistoryBody.biomarkers));

    const backoffice = await fetch(`${baseUrl}/api/backoffice/patients`, { headers: { cookie, Origin: origin } });
    const backofficeBody = await backoffice.json() as any;
    assert.equal(backoffice.status, 403);
    assert.equal(backofficeBody.error.code, "PROFESSIONAL_REQUIRED");

    const update = await fetch(`${baseUrl}/api/profile`, {
      method: "POST",
      headers: { cookie, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Usuário Isolado" })
    });
    assert.equal(update.status, 200);
    const ownProfile = await fetch(`${baseUrl}/api/profile`, { headers: { cookie, Origin: origin } }).then((response) => response.json() as any);
    assert.equal(ownProfile.profile.nome, "Usuário Isolado");
  });
});
