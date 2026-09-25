const GATEWAY_EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate";
const JEV_MODEL = "typesafe-ai/jev";
const MAX_CONCURRENT = 3;

const NEGATIVE_QUESTION = {
  negative: {
    type: "boolean",
    instructions:
      "Is this social media post negative for the reader? Judge the content and tone, in any language.",
    criteria: {
      true: "Insults, harassment, hate speech, threats, mockery, aggression, or doom-laden content likely to upset or hurt the reader",
      false: "Neutral, positive, informative, humorous, or friendly content",
    },
  },
};

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

async function jevEvaluate(text, apiKey) {
  const res = await fetch(GATEWAY_EVALUATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: text,
      questions: NEGATIVE_QUESTION,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI Gateway error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data?.answers?.negative;
  if (!answer || typeof answer.probability !== "number") {
    throw new Error("Unexpected evaluation response shape");
  }
  return { probability: answer.probability };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "xnf.evaluate" || typeof message.text !== "string") {
    return false;
  }

  (async () => {
    const config = await chrome.storage.local.get({
      apiKey: "",
      demoMode: false,
    });
    const text = message.text.slice(0, 4000);

    return new Promise((resolve) => {
      enqueue(async () => {
        try {
          const result = config.demoMode
            ? demoEvaluate(text)
            : config.apiKey
              ? await jevEvaluate(text, config.apiKey)
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
