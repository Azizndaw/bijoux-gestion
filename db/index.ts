import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema.js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

function getConnectionString() {
  if (typeof Netlify !== "undefined") {
    const value = Netlify.env.get("NETLIFY_DB_URL");
    if (value) return value;
  }
  return process.env.NETLIFY_DB_URL;
}

export const database = drizzle({ connection: getConnectionString(), schema });
