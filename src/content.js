(() => {
  const TWEET_SELECTOR = 'article[data-testid="tweet"]';
  const TEXT_SELECTOR = 'div[data-testid="tweetText"]';
  const STATUS_LINK_SELECTOR = 'a[href*="/status/"]';

  const PENDING_CLASS = "xnf-pending";
  const NEGATIVE_CLASS = "xnf-negative";
  const PROCESSED_ATTR = "data-xnf-processed";

  const verdicts = new Map();
  let enabled = false;
  let threshold = 0.5;
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
      article.classList.remove(PENDING_CLASS, NEGATIVE_CLASS);
      overlay.remove();
    });

    overlay.append(img, caption, reveal);
    return overlay;
  }

  function clearTweet(article) {
    article.classList.remove(PENDING_CLASS, NEGATIVE_CLASS);
    article.querySelector(":scope > .xnf-mosaic")?.remove();
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

    const probability = typeof result?.probability === "number" ? result.probability : 0;
    if (typeof result?.probability === "number" && probability >= threshold) {
      article.classList.add(NEGATIVE_CLASS);
      article.appendChild(buildMosaicOverlay(article));
    } else {
      article.classList.remove(PENDING_CLASS);
    }
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
    const config = await chrome.storage.local.get({ enabled: false, threshold: 0.5 });
    const wasEnabled = enabled;
    enabled = Boolean(config.enabled);
    threshold = typeof config.threshold === "number" ? config.threshold : 0.5;

    if (enabled && !wasEnabled) {
      startObserver();
      scan(document.documentElement);
    } else if (!enabled && wasEnabled) {
      clearAll();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.enabled || changes.threshold)) {
      refreshConfig();
    }
  });

  refreshConfig();
})();
