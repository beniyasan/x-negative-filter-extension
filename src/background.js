// Vercel AI Gateway uses its own evaluate API ("boolean" → probability);
// the TypeSafe official API and ロリポップ！AIゲートウェイ expose the native
// System One API ("noul" → noul).
const PROVIDERS = {
  vercel: {
    label: "Vercel AI Gateway",
    url: "https://ai-gateway.vercel.sh/v1/evaluate",
    model: "typesafe-ai/jev",
    keyField: "apiKey",
    questionType: "boolean",
  },
  typesafe: {
    label: "TypeSafe API",
    url: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest",
    keyField: "typesafeApiKey",
    questionType: "noul",
  },
  lolipop: {
    label: "ロリポップ！AIゲートウェイ",
    url: "https://ai-gateway.lolipop.jp/v1/systemone",
    model: "typesafe/jev-latest",
    keyField: "lolipopApiKey",
    questionType: "noul",
  },
};
const MAX_CONCURRENT = 3;

function negativeQuestion(type) {
  return {
    negative: {
      type,
      instructions:
        "Is this social media post negative for the reader? Judge the content and tone, in any language.",
      criteria: {
        true: "Insults, harassment, hate speech, threats, mockery, aggression, or doom-laden content likely to upset or hurt the reader",
        false: "Neutral, positive, informative, humorous, or friendly content",
      },
    },
  };
}

const DEMO_NEGATIVE_KEYWORDS = [
  "hate",
  "idiot",
  "stupid",
  "die",
  "kill",
  "worst",
  "terrible",
  "disgusting",
  "shut up",
  "loser",
  "dumb",
  "fuck",
  "trash",
  "ugly",
  "最低",
  "死ね",
  "バカ",
  "馬鹿",
  "クソ",
  "ゴミ",
  "嫌い",
  "大嫌い",
  "うざい",
  "きもい",
  "消えろ",
  "だまれ",
];

let inFlight = 0;
const queue = [];

function runNext() {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    inFlight++;
    job()
      .catch(() => {})
      .finally(() => {
        inFlight--;
        runNext();
      });
  }
}

function enqueue(job) {
  queue.push(job);
  runNext();
}

function demoEvaluate(text) {
  const lowered = text.toLowerCase();
  const hit = DEMO_NEGATIVE_KEYWORDS.some((word) => lowered.includes(word));
  return { probability: hit ? 0.95 : 0.05, demo: true };
}

async function jevEvaluate(text, provider, apiKey) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      state: text,
      questions: negativeQuestion(provider.questionType),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider.label} error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data?.answers?.negative;
  const probability = answer?.probability ?? answer?.noul;
  if (typeof probability !== "number") {
    throw new Error("Unexpected evaluation response shape");
  }
  return { probability };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "xnf.evaluate" || typeof message.text !== "string") {
    return false;
  }

  (async () => {
    const config = await chrome.storage.local.get({
      provider: "vercel",
      apiKey: "",
      typesafeApiKey: "",
      lolipopApiKey: "",
      demoMode: false,
    });
    const provider = PROVIDERS[config.provider] || PROVIDERS.vercel;
    const apiKey = config[provider.keyField];
    const text = message.text.slice(0, 4000);

    return new Promise((resolve) => {
      enqueue(async () => {
        try {
          const result = config.demoMode
            ? demoEvaluate(text)
            : apiKey
              ? await jevEvaluate(text, provider, apiKey)
              : { error: "missing-api-key" };
          resolve(result);
        } catch (err) {
          resolve({ error: String(err?.message || err) });
        }
      });
    });
  })()
    .then(sendResponse)
    .catch(() => sendResponse({ error: "unexpected-failure" }));

  return true;
});
