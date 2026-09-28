const apiKeyInput = document.getElementById("api-key");
const typesafeApiKeyInput = document.getElementById("typesafe-api-key");
const lolipopApiKeyInput = document.getElementById("lolipop-api-key");
const providerInputs = document.querySelectorAll('input[name="provider"]');
const thresholdInput = document.getElementById("threshold");
const thresholdValue = document.getElementById("threshold-value");
const demoModeInput = document.getElementById("demo-mode");
const showScoreInput = document.getElementById("show-score");
const saveButton = document.getElementById("save");
const savedEl = document.getElementById("saved");

function renderThreshold() {
  thresholdValue.textContent = Number(thresholdInput.value).toFixed(2);
}

function selectedProvider() {
  return [...providerInputs].find((input) => input.checked)?.value || "vercel";
}

function renderProvider() {
  const provider = selectedProvider();
  for (const section of document.querySelectorAll("section[data-provider]")) {
    section.hidden = section.dataset.provider !== provider;
  }
}

async function init() {
  const config = await chrome.storage.local.get({
    provider: "vercel",
    apiKey: "",
    typesafeApiKey: "",
    lolipopApiKey: "",
    threshold: 0.5,
    demoMode: false,
    showScore: false,
  });
  for (const input of providerInputs) {
    input.checked = input.value === config.provider;
  }
  apiKeyInput.value = config.apiKey;
  typesafeApiKeyInput.value = config.typesafeApiKey;
  lolipopApiKeyInput.value = config.lolipopApiKey;
  thresholdInput.value = String(config.threshold);
  demoModeInput.checked = config.demoMode;
  showScoreInput.checked = config.showScore;
  renderThreshold();
  renderProvider();
}

thresholdInput.addEventListener("input", renderThreshold);
for (const input of providerInputs) {
  input.addEventListener("change", renderProvider);
}

saveButton.addEventListener("click", async () => {
  await chrome.storage.local.set({
    provider: selectedProvider(),
    apiKey: apiKeyInput.value.trim(),
    typesafeApiKey: typesafeApiKeyInput.value.trim(),
    lolipopApiKey: lolipopApiKeyInput.value.trim(),
    threshold: Number(thresholdInput.value),
    demoMode: demoModeInput.checked,
    showScore: showScoreInput.checked,
  });
  savedEl.classList.add("show");
  setTimeout(() => savedEl.classList.remove("show"), 2000);
});

init();
