const { performance } = require("node:perf_hooks");

class PerfTimer {
  constructor(updateId) {
    this.updateId = updateId ?? "unknown";
    this.startedAt = performance.now();
    this.timings = new Map();
  }

  add(label, ms) {
    this.timings.set(label, (this.timings.get(label) || 0) + ms);
  }

  async time(label, fn) {
    const startedAt = performance.now();
    try {
      return await fn();
    } finally {
      this.add(label, performance.now() - startedAt);
    }
  }

  timeSync(label, fn) {
    const startedAt = performance.now();
    try {
      return fn();
    } finally {
      this.add(label, performance.now() - startedAt);
    }
  }

  log() {
    const foregroundTotal = performance.now() - this.startedAt;
    const labels = [
      "parse_update",
      "redis_get",
      "validation",
      "logic",
      "redis_save",
      "telegram_answer_callback",
      "telegram_send",
      "sheets"
    ];
    const parts = labels.map((label) => `${label}=${Math.round(this.timings.get(label) || 0)}ms`);
    parts.push(`foreground_total=${Math.round(foregroundTotal)}ms`);
    console.log(`PERF update=${this.updateId} ${parts.join(" ")}`);
  }
}

function logBackgroundSheetsSync(updateId, ms, ok) {
  console.log(`PERF update=${updateId ?? "unknown"} background_sheets_sync=${Math.round(ms)}ms background_sheets_ok=${ok ? 1 : 0}`);
}

function createPerfTimer(updateId) {
  return new PerfTimer(updateId);
}

module.exports = { PerfTimer, createPerfTimer, logBackgroundSheetsSync, performance };
