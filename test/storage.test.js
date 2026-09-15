const test = require("node:test");
const assert = require("node:assert/strict");

const { SESSION_TTL_SECONDS, createRedisSessionStore } = require("../src/storage/redis");

test("Redis session storage stores one JSON object with TTL", async () => {
  const calls = [];
  const redis = {
    async get(key) {
      calls.push(["get", key]);
      return { telegram_id: "456", current_question: "email" };
    },
    async set(key, value, options) {
      calls.push(["set", key, value, options]);
      return "OK";
    }
  };
  const store = createRedisSessionStore({}, redis);

  const session = await store.getSession("456");
  const saved = await store.saveSession({ ...session, current_question: "name" });

  assert.equal(calls[0][0], "get");
  assert.equal(calls[0][1], "casting:session:456");
  assert.equal(calls[1][0], "set");
  assert.equal(calls[1][1], "casting:session:456");
  assert.equal(calls[1][2].current_question, "name");
  assert.equal(calls[1][2].revision, 0);
  assert.deepEqual(calls[1][3], { ex: SESSION_TTL_SECONDS });
  assert.ok(saved.updatedAt);
});
