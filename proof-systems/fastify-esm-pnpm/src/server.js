import Fastify from "fastify"; import { workflow } from "./crypto.js";
export const app = Fastify(); app.get("/health", async () => ({ ok: true })); app.post("/workflow", async () => workflow());
if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, "$1")) await app.listen({ port: Number(process.env.PORT || 3102), host: "127.0.0.1" });
