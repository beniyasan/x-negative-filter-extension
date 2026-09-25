const enabledCheckbox = document.getElementById("enabled");
const statusEl = document.getElementById("status");
const optionsButton = document.getElementById("open-options");

async function refreshStatus() {
  const config = await chrome.storage.local.get({
    apiKey: "",
    demoMode: false,
    enabled: false,
  });

  statusEl.classList.remove("warn");

  if (config.demoMode) {
    statusEl.textContent = "デモモード中：APIを呼ばずに簡易判定します（テスト用）";
    statusEl.classList.add("warn");
    return;
  }

  if (!config.apiKey) {
    statusEl.textContent = "AI Gateway の API キーが未設定です。「設定」から登録してください。";
    statusEl.classList.add("warn");
    return;
  }

  statusEl.textContent = config.enabled
    ? "有効です。X のツイートを表示前に Jev で判定します。"
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
  if (area === "local" && (changes.apiKey || changes.demoMode)) {
    refreshStatus();
  }
});

init();
