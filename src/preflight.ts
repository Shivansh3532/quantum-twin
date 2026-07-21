import { Codex } from "@openai/codex-sdk";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { command } from "./util.ts";
import { CONTEXT, MODEL, SDK_VERSION } from "./domain.ts";

export async function preflight() {
  const key = generateKeyPairSync("ml-dsa-65");
  const other = generateKeyPairSync("ml-dsa-65");
  const payload = Buffer.from("quantum-twin-preflight");
  const signature = sign(null, payload, { key: key.privateKey, context: Buffer.from(CONTEXT) } as never);
  const crypto = {
    keyType: key.publicKey.asymmetricKeyType,
    verify: verify(null, payload, { key: key.publicKey, context: Buffer.from(CONTEXT) } as never, signature),
    tamperRejected: !verify(null, Buffer.concat([payload, Buffer.from("!")]), { key: key.publicKey, context: Buffer.from(CONTEXT) } as never, signature),
    wrongKeyRejected: !verify(null, payload, { key: other.publicKey, context: Buffer.from(CONTEXT) } as never, signature),
    wrongContextRejected: !verify(null, payload, { key: key.publicKey, context: Buffer.from(`${CONTEXT}:wrong`) } as never, signature)
  };
  const temp = await mkdtemp(path.join(os.tmpdir(), "quantum-twin-sdk-"));
  try {
    await writeFile(path.join(temp, "README.md"), "SDK preflight\n");
    await command("git", ["init"], temp);
    await command("git", ["add", "."], temp);
    await command("git", ["-c", "user.name=Quantum Twin", "-c", "user.email=quantum-twin@local", "commit", "-m", "preflight"], temp);
    const codex = new Codex();
    const thread = codex.startThread({ model: MODEL, modelReasoningEffort: "high", workingDirectory: temp, sandboxMode: "workspace-write", networkAccessEnabled: false, webSearchMode: "disabled", approvalPolicy: "never" });
    let turn;
    try {
      turn = await thread.run("Reply with exactly SDK_OK. Do not modify files.");
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      if (/not supported when using Codex with a ChatGPT account|invalid_request_error|"status":\s*400/i.test(raw)) {
        throw new Error(`Codex rejected model "${MODEL}". A free ChatGPT account has no Codex model entitlement — use a paid ChatGPT plan, or API billing via "codex login --with-api-key", or set QT_MODEL to a model your account allows. The full UI (no Codex needed) is live at https://quantum-twin.vercel.app. Original error: ${raw}`);
      }
      throw error;
    }
    const controller = new AbortController();
    controller.abort();
    let abortSignalCancelled = false;
    try { await thread.run("Wait and then reply.", { signal: controller.signal }); } catch { abortSignalCancelled = true; }
    return { nodeVersion: process.version, model: MODEL, codexSdkVersion: SDK_VERSION, authentication: { codexSdk: "authenticated", responsesApi: process.env.OPENAI_API_KEY ? "optional_key_present_not_logged" : "optional_not_configured" }, crypto, sdk: { threadId: thread.id, response: turn.finalResponse.trim(), abortSignalCancelled } };
  } finally { await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {}); }
}
