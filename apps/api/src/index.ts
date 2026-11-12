import { FundService } from "./service.ts";
import { createApp } from "./app.ts";
const service = new FundService();
await service.initialize();
const app = await createApp(service);
await app.listen({
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "127.0.0.1",
});
console.log(
  `FINVERIC API: http://127.0.0.1:${process.env.PORT ?? 3001} · chain ${service.dep.chainId}`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
