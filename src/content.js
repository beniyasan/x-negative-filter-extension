(() => {
  const TWEET_SELECTOR = 'article[data-testid="tweet"]';
  const TEXT_SELECTOR = 'div[data-testid="tweetText"]';
  const STATUS_LINK_SELECTOR = 'a[href*="/status/"]';

  const PENDING_CLASS = "xnf-pending";
  const NEGATIVE_CLASS = "xnf-negative";
  const PROCESSED_ATTR = "data-xnf-processed";

  const verdicts = new Map();
  const verdictByArticle = new WeakMap();
  let enabled = false;
  let threshold = 0.5;
  let showScore = false;
  let observer = null;

  function tweetKey(article, text) {
    const statusLink = article.querySelector(STATUS_LINK_SELECTOR);
    const href = statusLink?.getAttribute("href") || "";
    const match = href.match(/\/status\/(\d+)/);
    if (match) return `status:${match[1]}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return `text:${hash}:${text.length}`;
  }

  function requestVerdict(text) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "xnf.evaluate", text }, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }
        resolve(result || { error: "no-response" });
      });
    });
  }

  function buildMosaicOverlay(article) {
    const overlay = document.createElement("div");
    overlay.className = "xnf-mosaic";

    const img = document.createElement("img");
    img.className = "xnf-mosaic-img";
    img.src = chrome.runtime.getURL("assets/miserarenaiyo.png");
    img.alt = "見せられないよ！";

    const caption = document.createElement("div");
    caption.className = "xnf-mosaic-caption";
    caption.textContent = "見せられないよ！";

    const reveal = document.createElement("button");
    reveal.className = "xnf-mosaic-reveal";
    reveal.type = "button";
    reveal.textContent = "それでも表示する";
    reveal.addEventListener("click", (event) => {
      event.stopPropagation();
      article.setAttribute(PROCESSED_ATTR, "revealed");
      article.classList.remove(PENDING_CLASS, NEGATIVE_CLASS);
      overlay.remove();
    });

    overlay.append(img, caption, reveal);
    return overlay;
  }

  function applyVerdict(article, result) {
    const negative =
      typeof result?.probability === "number" && result.probability >= threshold;
    if (negative) {
      article.classList.add(PENDING_CLASS, NEGATIVE_CLASS);
      if (!article.querySelector(":scope > .xnf-mosaic")) {
        article.appendChild(buildMosaicOverlay(article));
      }
    } else {
      article.classList.remove(PENDING_CLASS, NEGATIVE_CLASS);
      article.querySelector(":scope > .xnf-mosaic")?.remove();
    }
  }

  function applyScoreBadge(article) {
    const result = verdictByArticle.get(article);
    if (!result) return;

    let badge = article.querySelector(":scope > .xnf-score");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "xnf-score";
      article.appendChild(badge);
    }
    badge.classList.remove("xnf-score-neg", "xnf-score-pos", "xnf-score-err");

    if (typeof result.probability === "number") {
      const pct = Math.round(result.probability * 100);
      const negative = result.probability >= threshold;
      badge.textContent = `ネガティブ ${pct}%${result.demo ? " (demo)" : ""}`;
      badge.classList.add(negative ? "xnf-score-neg" : "xnf-score-pos");
      badge.title = `ネガティブ確率 ${pct}%（しきい値 ${Math.round(threshold * 100)}%）`;
    } else {
      badge.textContent = "判定エラー";
      badge.classList.add("xnf-score-err");
      badge.title = String(result.error || "unknown error");
    }
  }

  function clearTweet(article) {
    article.classList.remove(PENDING_CLASS, NEGATIVE_CLASS);
    article
      .querySelectorAll(":scope > .xnf-mosaic, :scope > .xnf-score")
      .forEach((el) => el.remove());
    verdictByArticle.delete(article);
    article.removeAttribute(PROCESSED_ATTR);
  }

  function clearAll() {
    document.querySelectorAll(TWEET_SELECTOR).forEach(clearTweet);
  }

  async function processTweet(article) {
    if (article.hasAttribute(PROCESSED_ATTR)) return;
    const textEl = article.querySelector(TEXT_SELECTOR);
    const text = textEl?.innerText?.trim();
    if (!text) return;

    article.setAttribute(PROCESSED_ATTR, "pending");
    const key = tweetKey(article, text);
    article.classList.add(PENDING_CLASS);

    const cached = verdicts.get(key);
    const result = cached ?? (await requestVerdict(text));
    if (cached === undefined) verdicts.set(key, result);

    if (!article.isConnected || article.getAttribute(PROCESSED_ATTR) !== "pending") return;

    verdictByArticle.set(article, result);
    if (showScore) applyScoreBadge(article);
    applyVerdict(article, result);
  }

  function scan(root) {
    const articles =
      root instanceof Element && root.matches?.(TWEET_SELECTOR)
        ? [root]
        : Array.from(root.querySelectorAll?.(TWEET_SELECTOR) ?? []);
    articles.forEach((article) => {
      processTweet(article).catch(() => {
        article.classList.remove(PENDING_CLASS);
      });
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!enabled) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function refreshConfig() {
    const config = await chrome.storage.local.get({
      enabled: false,
      threshold: 0.5,
      showScore: false,
    });
    const wasEnabled = enabled;
    enabled = Boolean(config.enabled);
    threshold = typeof config.threshold === "number" ? config.threshold : 0.5;
    showScore = Boolean(config.showScore);

    if (enabled) {
      document.querySelectorAll(TWEET_SELECTOR).forEach((article) => {
        if (article.getAttribute(PROCESSED_ATTR) === "pending") {
          const result = verdictByArticle.get(article);
          if (result) applyVerdict(article, result);
        }
        if (showScore) applyScoreBadge(article);
        else article.querySelector(":scope > .xnf-score")?.remove();
      });
    } else {
      document.querySelectorAll(".xnf-score").forEach((el) => el.remove());
    }

    if (enabled && !wasEnabled) {
      startObserver();
      scan(document.documentElement);
    } else if (!enabled && wasEnabled) {
      clearAll();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.enabled || changes.threshold || changes.showScore)) {
      refreshConfig();
    }
  });

  refreshConfig();
})();
