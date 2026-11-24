import assert from "node:assert/strict";
import test from "node:test";
import { ResourceCache } from "../src/lib/resource-cache.ts";
import { isCurrentSession } from "../src/lib/session-scope.ts";

test("an obsolete response cannot sign out a new login, including the same user", () => {
  const session = (user, id, revision) => ({
    user: { id: user },
    access_token: `header.${Buffer.from(JSON.stringify({ session_id: id, revision })).toString("base64url")}.signature`,
  });
  const original = session("agus", "session-one", 1);
  assert.equal(
    isCurrentSession(original, session("agus", "session-one", 2)),
    true,
  );
  assert.equal(
    isCurrentSession(original, session("agus", "session-two", 1)),
    false,
  );
  assert.equal(
    isCurrentSession(original, session("member", "session-other", 1)),
    false,
  );
  assert.equal(isCurrentSession(original, null), false);
});

test("concurrent requests share one fetch and switching back reuses data", async () => {
  const cache = new ResourceCache();
  let calls = 0;
  const load = async () => {
    calls += 1;
    return { dataset: "seed-42" };
  };
  const [first, second] = await Promise.all([
    cache.load("session-a:42", load),
    cache.load("session-a:42", load),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(await cache.load("session-a:42", load), first);
  assert.equal(calls, 1);
});

test("dataset and session keys never share values", async () => {
  const cache = new ResourceCache();
  cache.seed("session-a:main", { value: "main" });
  assert.equal(cache.peek("session-a:42"), undefined);
  assert.equal(cache.peek("session-b:main"), undefined);
});

test("logout clearing cannot be undone by an old pending request", async () => {
  const cache = new ResourceCache();
  let complete;
  const pending = cache.load(
    "old-session",
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await Promise.resolve();
  cache.clear();
  complete("old data");
  await pending;
  assert.equal(cache.peek("old-session"), undefined);
});

test("failed requests can retry and a fresh value wins over old work", async () => {
  const cache = new ResourceCache();
  await assert.rejects(
    cache.load("retry", async () => {
      throw new Error("offline");
    }),
  );
  assert.equal(await cache.load("retry", async () => "recovered"), "recovered");
  let complete;
  const pending = cache.load(
    "fresh",
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await Promise.resolve();
  cache.seed("fresh", "newer");
  complete("older");
  await pending;
  assert.equal(cache.peek("fresh"), "newer");
});

test("expired entries and explicit refresh fetch again", async () => {
  const cache = new ResourceCache(-1);
  cache.seed("expired", "old");
  assert.equal(cache.peek("expired"), undefined);
  assert.equal(await cache.load("expired", async () => "new"), "new");
  const stable = new ResourceCache();
  stable.seed("refresh", "old");
  stable.delete("refresh");
  assert.equal(
    await stable.load("refresh", async () => "reloaded"),
    "reloaded",
  );
});
