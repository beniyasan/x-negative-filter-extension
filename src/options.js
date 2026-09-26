const apiKeyInput = document.getElementById("api-key");
const thresholdInput = document.getElementById("threshold");
const thresholdValue = document.getElementById("threshold-value");
const demoModeInput = document.getElementById("demo-mode");
const showScoreInput = document.getElementById("show-score");
const saveButton = document.getElementById("save");
const savedEl = document.getElementById("saved");

function renderThreshold() {
  thresholdValue.textContent = Number(thresholdInput.value).toFixed(2);
}

async function init() {
  const config = await chrome.storage.local.get({
    apiKey: "",
    threshold: 0.5,
    demoMode: false,
    showScore: false,
  });
  apiKeyInput.value = config.apiKey;
  thresholdInput.value = String(config.threshold);
  demoModeInput.checked = config.demoMode;
  showScoreInput.checked = config.showScore;
  renderThreshold();
}

thresholdInput.addEventListener("input", renderThreshold);

saveButton.addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    threshold: Number(thresholdInput.value),
    demoMode: demoModeInput.checked,
    showScore: showScoreInput.checked,
  });
  savedEl.classList.add("show");
  setTimeout(() => savedEl.classList.remove("show"), 2000);
});

init();
