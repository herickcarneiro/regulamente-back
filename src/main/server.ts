import { composeApp } from './composition-root';

export async function startServer(
  source: Record<string, string | undefined> = process.env,
) {
  const { app, env, database } = composeApp(source);

  const server = app.listen(env.PORT);

  const shutdown = async () => {
    server.stop();
    await database.close();
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  console.log(
    `regulamente-back listening on http://localhost:${env.PORT}`,
  );

  return { app, env, database, shutdown };
}

if (import.meta.main) {
  await startServer();
}
