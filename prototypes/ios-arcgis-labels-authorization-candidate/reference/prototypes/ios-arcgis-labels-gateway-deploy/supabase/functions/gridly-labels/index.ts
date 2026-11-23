import postgres from "npm:postgres@3.4.8";
import { createRuntime } from "./runtime.mjs";

const get = (name: string) => Deno.env.get(name);
Deno.serve(createRuntime({
  get,
  connect(dsn: string) {
    const ca = get("GRIDLY_LABELS_DATABASE_CA_PEM");
    if (!ca || ca.length > 32_768 || !ca.startsWith("-----BEGIN CERTIFICATE-----")) {
      throw new Error("database_trust_unavailable");
    }
    const sql = postgres(dsn, { ssl: { rejectUnauthorized: true, ca }, prepare: false,
      max: 2, connect_timeout: 3, idle_timeout: 5,
      connection: { statement_timeout: 2000, lock_timeout: 750 },
      onnotice: () => {} });
    return async (statement: string, values: (string | number)[]) =>
      ({ rows: await sql.unsafe(statement, values) });
  },
  // Deliberately unwired until the isolated StoreKit and App Attest adapters
  // have been reviewed. The server has no fixture or client-verdict path.
  admission: undefined,
  transport: fetch
}));
