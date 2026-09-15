function waitUntilTask(task, waitUntilOverride) {
  if (typeof waitUntilOverride === "function") {
    waitUntilOverride(task);
    return;
  }

  const promise = Promise.resolve().then(task);
  try {
    const { waitUntil } = require("@vercel/functions");
    waitUntil(promise);
  } catch {
    promise.catch(() => null);
  }
}

module.exports = { waitUntilTask };
