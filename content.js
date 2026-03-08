// X Image Catcher — content.js
// x.com タイムラインに表示された画像を自動キャプチャして chrome.storage.local に保存する

const MEDIA_HOST = 'pbs.twimg.com/media/';
const MAX_ITEMS = 1000;
const capturedIds = new Set();
// IntersectionObserver に登録済みの img 要素を追跡（重複 observe 防止）
const observedImgs = new WeakSet();
// ストレージ書き込みを直列化するキュー
let saveQueue = Promise.resolve();

// ---- ユーティリティ ----

/**
 * img 要素の src/srcset から pbs.twimg.com/media/ URL を抽出する
 * @param {HTMLImageElement} img
 * @returns {string|null}
 */
function extractMediaUrl(img) {
  const src = img.src || '';
  if (src.includes(MEDIA_HOST)) {
    // name= パラメータがあれば large に、なければ付加する
    if (src.includes('name=')) {
      return src.replace(/name=\w+/, 'name=large');
    }
    return src.includes('?') ? src + '&name=large' : src + '?name=large';
  }
  // srcset からも探す
  const srcset = img.srcset || '';
  if (srcset.includes(MEDIA_HOST)) {
    const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
    for (const url of parts) {
      if (url.includes(MEDIA_HOST)) {
        if (url.includes('name=')) return url.replace(/name=\w+/, 'name=large');
        return url.includes('?') ? url + '&name=large' : url + '?name=large';
      }
    }
  }
  return null;
}

/**
 * img 要素の最近祖先ツイート要素を探してメタデータを取得する
 * @param {HTMLImageElement} img
 * @returns {{tweetId:string, tweetUrl:string, authorName:string, authorHandle:string, authorAvatar:string}|null}
 */
function extractTweetMeta(img) {
  // 最近祖先の <article> を探す
  let el = img.parentElement;
  let articleEl = null;
  while (el) {
    if (el.tagName === 'ARTICLE') { articleEl = el; break; }
    el = el.parentElement;
  }
  if (!articleEl) return null;

  // ツイートURLを <a href="*/status/*"> から取得
  // X は複数の status リンクを持つ場合があるが最初のものがツイート本体
  let tweetId = null;
  let tweetUrl = null;
  const statusLinks = articleEl.querySelectorAll('a[href*="/status/"]');
  for (const a of statusLinks) {
    const match = a.href.match(/\/status\/(\d+)/);
    if (match) {
      tweetId = match[1];
      // クリーンなツイートURLを構築（クエリパラメータを除去）
      try {
        const u = new URL(a.href);
        const pathMatch = u.pathname.match(/^(\/[^/]+\/status\/\d+)/);
        tweetUrl = pathMatch ? u.origin + pathMatch[1] : u.origin + u.pathname;
      } catch (_) {
        tweetUrl = a.href.split('?')[0];
      }
      break;
    }
  }
  if (!tweetId) return null;

  // アバター画像
  let authorAvatar = '';
  const avatarImg = articleEl.querySelector('img[src*="profile_images"]');
  if (avatarImg) authorAvatar = avatarImg.src;

  // 表示名と @handle
  // X の DOM: <a href="/handle"><div>...<span>DisplayName</span>...</div></a>
  let authorName = '';
  let authorHandle = '';
  const userLinks = articleEl.querySelectorAll('a[href^="/"]');
  for (const a of userLinks) {
    const href = a.getAttribute('href') || '';
    // /handle 形式（スラッシュ1つ + 英数字アンダースコアのみ）
    if (/^\/[A-Za-z0-9_]+$/.test(href)) {
      authorHandle = '@' + href.slice(1);
      const nameEl = a.querySelector('span > span') || a.querySelector('span');
      if (nameEl) authorName = nameEl.textContent.trim();
      break;
    }
  }

  return { tweetId, tweetUrl, authorName, authorHandle, authorAvatar };
}

// ---- キャプチャ処理 ----

/**
 * img の祖先 article が広告かどうかを判定する
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
function isAdImage(img) {
  let el = img.parentElement;
  while (el) {
    if (el.tagName === 'ARTICLE') {
      if (el.querySelector('[data-testid="promotedIndicator"]')) return true;
      if (el.querySelector('[data-testid="placementTracking"]')) return true;
      // "Promoted" テキストを持つ leaf span を探す（ローカライズ対応）
      for (const span of el.querySelectorAll('span')) {
        if (span.childElementCount === 0) {
          const t = span.textContent.trim();
          if (t === 'Promoted' || t === 'プロモーション' || t === 'Ad') return true;
        }
      }
      return false;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * 画像要素をキャプチャしてストレージに保存する
 * @param {HTMLImageElement} img
 * @param {number} imageIndex
 */
async function captureImage(img, imageIndex) {
  const imageUrl = extractMediaUrl(img);
  if (!imageUrl) return;

  if (isAdImage(img)) return;

  // DOM がまだ完全にレンダリングされていない場合はリトライ
  let meta = extractTweetMeta(img);
  if (!meta) {
    for (const delay of [200, 600, 1500]) {
      await new Promise(r => setTimeout(r, delay));
      // 仮想スクロールで img が別のコンテンツに使い回されていたら中断
      const currentUrl = extractMediaUrl(img);
      if (!currentUrl || currentUrl !== imageUrl) return;
      meta = extractTweetMeta(img);
      if (meta) break;
    }
    if (!meta) return;
  }

  const id = `tweet_${meta.tweetId}_${imageIndex}`;
  if (capturedIds.has(id)) return;
  capturedIds.add(id);

  const item = {
    id,
    tweetId: meta.tweetId,
    tweetUrl: meta.tweetUrl,
    authorName: meta.authorName,
    authorHandle: meta.authorHandle,
    authorAvatar: meta.authorAvatar,
    imageUrl,
    capturedAt: new Date().toISOString(),
  };

  // 非同期でストレージに保存（直列化して競合を防ぐ）
  saveQueue = saveQueue.then(async () => {
    try {
      const data = await chrome.storage.local.get(['images', 'unseenCount']);
      const images = data.images || [];
      const unseenCount = data.unseenCount || 0;

      // 重複チェック（ストレージ上でも確認）
      if (images.some(i => i.id === id)) return;

      images.push(item);

      // 最大件数を超えた場合は古い順に削除
      let trimmed = images;
      if (images.length > MAX_ITEMS) {
        trimmed = images
          .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
          .slice(images.length - MAX_ITEMS);
      }

      await chrome.storage.local.set({
        images: trimmed,
        unseenCount: unseenCount + 1,
      });

      // background service worker にバッジ更新を依頼
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: unseenCount + 1 });
    } catch (e) {
      // 保存失敗時はリトライできるよう capturedIds から除去
      capturedIds.delete(id);
    }
  });
}

/**
 * img 要素を IntersectionObserver に登録する（重複防止）
 * @param {HTMLImageElement} img
 */
function scheduleImg(img) {
  if (observedImgs.has(img)) return;
  const src = img.src || '';
  const srcset = img.srcset || '';
  if (!src.includes(MEDIA_HOST) && !srcset.includes(MEDIA_HOST)) return;
  observedImgs.add(img);
  intersectionObserver.observe(img);
}

const intersectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      intersectionObserver.unobserve(img);
      // 要素の再利用（仮想スクロール）に対応するため観測済みフラグを解除
      observedImgs.delete(img);

      // 同一ツイート内の画像インデックスを特定
      let articleEl = img.parentElement;
      while (articleEl && articleEl.tagName !== 'ARTICLE') {
        articleEl = articleEl.parentElement;
      }
      if (!articleEl) continue;

      const mediaImgs = Array.from(
        articleEl.querySelectorAll(`img[src*="${MEDIA_HOST}"], img[srcset*="${MEDIA_HOST}"]`)
      );
      const idx = mediaImgs.indexOf(img);
      const imageIndex = idx >= 0 ? idx : 0;

      captureImage(img, imageIndex);
    }
  },
  { threshold: 0.1 }
);

// ---- MutationObserver ----

/**
 * ノード内の対象画像要素を IntersectionObserver に登録する
 * @param {Node} root
 */
function observeImages(root) {
  if (!(root instanceof Element)) return;
  const selector = `img[src*="${MEDIA_HOST}"], img[srcset*="${MEDIA_HOST}"]`;
  if (root.matches(selector)) {
    scheduleImg(/** @type {HTMLImageElement} */ (root));
  } else {
    root.querySelectorAll(selector).forEach(scheduleImg);
  }
}

const mutationObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        observeImages(node);
      }
    } else if (mutation.type === 'attributes') {
      // X が後から src/srcset を設定したタイミングを検知
      const target = mutation.target;
      if (target instanceof HTMLImageElement) {
        scheduleImg(target);
      }
    }
  }
});

mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset'],
});

// 既に表示されている画像も対象にする
observeImages(document.body);
