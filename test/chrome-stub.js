// Standalone test stub: emulates just enough of the chrome.* API surface for
// content.js to run on a mock page without an extension context.
// Uses the same demo heuristics as src/background.js demoMode.

window.__xnfStorage = {
  enabled: true,
  threshold: 0.5,
  demoMode: true,
};

const XNF_DEMO_NEGATIVE_KEYWORDS = [
  "hate", "idiot", "stupid", "die", "kill", "worst", "terrible",
  "disgusting", "shut up", "loser", "dumb", "fuck", "trash", "ugly",
  "最低", "死ね", "バカ", "馬鹿", "クソ", "ゴミ", "嫌い", "大嫌い",
  "うざい", "きもい", "消えろ", "だまれ",
];

const listeners = { storageChanged: [] };

window.chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      setTimeout(() => {
        if (message?.type !== "xnf.evaluate") {
          callback({ error: "unknown-message" });
          return;
        }
        const lowered = String(message.text).toLowerCase();
        const hit = XNF_DEMO_NEGATIVE_KEYWORDS.some((w) => lowered.includes(w));
        // Simulate a bit of network latency so the pending blur is observable.
        setTimeout(() => callback({ probability: hit ? 0.95 : 0.05, demo: true }), 120);
      }, 0);
    },
    getURL(path) {
      return `../${path}`;
    },
    openOptionsPage() {},
  },
  storage: {
    local: {
      async get(defaults) {
        const out = {};
        for (const key of Object.keys(defaults)) {
          out[key] = key in window.__xnfStorage ? window.__xnfStorage[key] : defaults[key];
        }
        return out;
      },
      async set(values) {
        Object.assign(window.__xnfStorage, values);
        const changes = {};
        for (const key of Object.keys(values)) changes[key] = { newValue: values[key] };
        listeners.storageChanged.forEach((fn) => fn(changes, "local"));
      },
    },
    onChanged: {
      addListener(fn) {
        listeners.storageChanged.push(fn);
      },
    },
  },
};
