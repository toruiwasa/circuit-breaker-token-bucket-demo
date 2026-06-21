import { RedisContainer } from "@testcontainers/redis";

let container: Awaited<ReturnType<RedisContainer["start"]>>;

export async function setup() {
  container = await new RedisContainer("redis:7-alpine").start();
  process.env.REDIS_TEST_URL = container.getConnectionUrl();
}

export async function teardown() {
  await container?.stop();
}
