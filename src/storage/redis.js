const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
let redisClient = null;

function getRedisClient(env = process.env) {
  if (redisClient) return redisClient;
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    throw new Error("Redis is not configured: KV_REST_API_URL and KV_REST_API_TOKEN are required");
  }

  const { Redis } = require("@upstash/redis");
  redisClient = new Redis({
    url: env.KV_REST_API_URL,
    token: env.KV_REST_API_TOKEN
  });
  return redisClient;
}

function createRedisSessionStore(env = process.env, redis = getRedisClient(env)) {
  return {
    key(telegramId) {
      return `casting:session:${telegramId}`;
    },
    async getSession(telegramId) {
      return redis.get(this.key(telegramId));
    },
    async saveSession(session) {
      if (!session || !session.telegram_id) {
        throw new Error("Cannot save session without telegram_id");
      }
      const updatedSession = {
        ...session,
        revision: normalizeRevision(session.revision),
        updatedAt: new Date().toISOString()
      };
      await redis.set(this.key(updatedSession.telegram_id), updatedSession, { ex: SESSION_TTL_SECONDS });
      return updatedSession;
    },
    async deleteSession(telegramId) {
      return redis.del(this.key(telegramId));
    }
  };
}

function normalizeRevision(value) {
  const revision = Number(value || 0);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
}

module.exports = {
  SESSION_TTL_SECONDS,
  createRedisSessionStore,
  getRedisClient
};
