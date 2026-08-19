import { eq } from "drizzle-orm";
import serverless from "serverless-http";
import { database } from "../../db/index.js";
import { appState } from "../../db/schema.js";
import legacyDatabase from "../../src/db.js";
import serverModule from "../../src/server.js";

const { app, initializeData } = serverModule;
const expressHandler = serverless(app);

export const handler = async (event: Record<string, any>, context: Record<string, any>) => {
  const [storedState] = await database
    .select()
    .from(appState)
    .where(eq(appState.id, 1))
    .limit(1);

  if (storedState) {
    legacyDatabase.setRemoteData(storedState.data);
  } else {
    legacyDatabase.setRemoteData(legacyDatabase.getSnapshot());
  }

  initializeData();

  event.path = String(event.path || "/").replace(
    /^\/\.netlify\/functions\/api/,
    "/api",
  );

  const response = await expressHandler(event, context);
  const snapshot = legacyDatabase.getSnapshot();

  await database
    .insert(appState)
    .values({ id: 1, data: snapshot, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appState.id,
      set: { data: snapshot, updatedAt: new Date() },
    });

  return response;
};
