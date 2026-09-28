const enabledCheckbox = document.getElementById("enabled");
const statusEl = document.getElementById("status");
const optionsButton = document.getElementById("open-options");

const PROVIDERS = {
  vercel: { label: "Vercel AI Gateway", keyField: "apiKey" },
  typesafe: { label: "TypeSafe API", keyField: "typesafeApiKey" },
  lolipop: { label: "ロリポップ！AIゲートウェイ", keyField: "lolipopApiKey" },
};

async function refreshStatus() {
  const config = await chrome.storage.local.get({
    provider: "vercel",
    apiKey: "",
    typesafeApiKey: "",
    lolipopApiKey: "",
    demoMode: false,
    enabled: false,
  });

  statusEl.classList.remove("warn");

  if (config.demoMode) {
    statusEl.textContent = "デモモード中：APIを呼ばずに簡易判定します（テスト用）";
    statusEl.classList.add("warn");
    return;
  }

  const provider = PROVIDERS[config.provider] || PROVIDERS.vercel;
  if (!config[provider.keyField]) {
    statusEl.textContent = `${provider.label} の API キーが未設定です。「設定」から登録してください。`;
    statusEl.classList.add("warn");
    return;
  }

  statusEl.textContent = config.enabled
    ? `有効です。X のツイートを表示前に Jev（${provider.label}）で判定します。`
    : "無効です。有効化するとネガティブなツイートにモザイクをかけます。";
}

async function init() {
  const { enabled } = await chrome.storage.local.get({ enabled: false });
  enabledCheckbox.checked = Boolean(enabled);
  await refreshStatus();
}

enabledCheckbox.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledCheckbox.checked });
  await refreshStatus();
});

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  const keys = ["provider", "apiKey", "typesafeApiKey", "lolipopApiKey", "demoMode"];
  if (area === "local" && keys.some((key) => changes[key])) {
    refreshStatus();
  }
});

init();
