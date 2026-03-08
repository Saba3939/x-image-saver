// X Image Catcher — popup.js

const gallery = document.getElementById('gallery');
const emptyMsg = document.getElementById('empty-msg');
const countLabel = document.getElementById('count-label');
const btnClearAll = document.getElementById('btn-clear-all');
const searchInput = document.getElementById('search-input');
const btnShare = document.getElementById('btn-share');

const PAGE_SIZE = 50;
let allImages = [];
let filteredImages = [];
let viewedAtMap = {};
let renderedCount = 0;

// ---- 初期化 ----

async function init() {
  const data = await chrome.storage.local.get(['images', 'unseenCount', 'viewedAt']);
  viewedAtMap = data.viewedAt || {};
  allImages = sortImages(data.images || [], viewedAtMap);
  filteredImages = allImages;

  renderGallery();
  updateCountLabel();

  // ポップアップを開いたので未確認カウントをリセット
  await chrome.storage.local.set({ unseenCount: 0 });
  await chrome.action.setBadgeText({ text: '' });
}

// ---- ソート ----

/**
 * 最近閲覧したものを先頭に、残りはキャプチャ日時の新しい順に並べる
 * @param {object[]} images
 * @param {object} viewedAt  { [id]: ISOString }
 * @returns {object[]}
 */
function sortImages(images, viewedAt) {
  return images.slice().sort((a, b) => {
    const aKey = viewedAt[a.id] || '';
    const bKey = viewedAt[b.id] || '';
    if (aKey && bKey) return bKey.localeCompare(aKey);
    if (aKey) return -1;
    if (bKey) return 1;
    return b.capturedAt.localeCompare(a.capturedAt);
  });
}

// ---- 検索・フィルタ ----

function applyFilter(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    filteredImages = allImages;
  } else {
    filteredImages = allImages.filter(item => {
      const handle = (item.authorHandle || '').toLowerCase();
      const name = (item.authorName || '').toLowerCase();
      return handle.includes(q) || name.includes(q);
    });
  }
  renderGallery();
  updateCountLabel();
}

// ---- 描画 ----

/**
 * ギャラリーを初期描画する
 */
function renderGallery() {
  Array.from(gallery.children).forEach(child => {
    if (child !== emptyMsg) child.remove();
  });
  renderedCount = 0;

  if (filteredImages.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;
  appendNextPage();
}

/**
 * 次の PAGE_SIZE 件をギャラリーに追加する
 */
function appendNextPage() {
  const existingBtn = document.getElementById('btn-load-more');
  if (existingBtn) existingBtn.remove();

  const slice = filteredImages.slice(renderedCount, renderedCount + PAGE_SIZE);
  for (const item of slice) {
    gallery.appendChild(createCard(item));
  }
  renderedCount += slice.length;

  if (renderedCount < filteredImages.length) {
    const btn = document.createElement('button');
    btn.id = 'btn-load-more';
    btn.className = 'btn-load-more';
    btn.textContent = `もっと見る（残り ${filteredImages.length - renderedCount} 件）`;
    btn.addEventListener('click', appendNextPage);
    gallery.appendChild(btn);
  }
}

/**
 * サムネイルカード要素を作成する
 * @param {object} item
 * @returns {HTMLElement}
 */
function createCard(item) {
  const card = document.createElement('div');
  card.className = 'thumb-card';
  card.dataset.id = item.id;

  const img = document.createElement('img');
  img.className = 'thumb-img';
  img.src = item.imageUrl;
  img.alt = item.authorHandle || '';
  img.loading = 'lazy';

  card.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-delete')) return;
    const data = await chrome.storage.local.get('viewedAt');
    const map = data.viewedAt || {};
    map[item.id] = new Date().toISOString();
    chrome.storage.local.set({ viewedAt: map });
    chrome.tabs.create({ url: item.tweetUrl });
  });

  const overlay = document.createElement('div');
  overlay.className = 'thumb-overlay';

  const authorDiv = document.createElement('div');
  authorDiv.className = 'thumb-author';

  if (item.authorAvatar) {
    const avatar = document.createElement('img');
    avatar.className = 'thumb-avatar';
    avatar.src = item.authorAvatar;
    avatar.alt = '';
    authorDiv.appendChild(avatar);
  }

  const handle = document.createElement('span');
  handle.className = 'thumb-handle';
  handle.textContent = item.authorHandle || '';
  authorDiv.appendChild(handle);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-delete';
  btnDel.title = '削除';
  btnDel.textContent = '✕';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteItem(item.id);
  });

  overlay.appendChild(authorDiv);
  overlay.appendChild(btnDel);
  card.appendChild(img);
  card.appendChild(overlay);

  return card;
}

// ---- 削除 ----

async function deleteItem(id) {
  const data = await chrome.storage.local.get('images');
  const images = (data.images || []).filter(i => i.id !== id);
  await chrome.storage.local.set({ images });

  const idx = allImages.findIndex(i => i.id === id);
  if (idx !== -1) allImages.splice(idx, 1);

  const fidx = filteredImages.findIndex(i => i.id === id);
  if (fidx !== -1) {
    filteredImages.splice(fidx, 1);
    if (fidx < renderedCount) renderedCount--;
  }

  const card = gallery.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  updateCountLabel();
  if (filteredImages.length === 0) emptyMsg.hidden = false;

  const btn = document.getElementById('btn-load-more');
  if (btn) {
    const remaining = filteredImages.length - renderedCount;
    if (remaining > 0) {
      btn.textContent = `もっと見る（残り ${remaining} 件）`;
    } else {
      btn.remove();
    }
  }
}

async function clearAll() {
  await chrome.storage.local.set({ images: [], unseenCount: 0, viewedAt: {} });
  await chrome.action.setBadgeText({ text: '' });
  allImages = [];
  filteredImages = [];
  renderedCount = 0;
  searchInput.value = '';
  renderGallery();
  updateCountLabel();
}

// ---- ヘルパー ----

function updateCountLabel() {
  const total = allImages.length;
  const filtered = filteredImages.length;
  if (searchInput.value.trim() && filtered !== total) {
    countLabel.textContent = `${filtered}件表示（全${total}件）`;
  } else {
    countLabel.textContent = `${total}件保存済み`;
  }
}

// ---- イベント ----

let clearConfirmPending = false;
let clearConfirmTimer = null;

btnClearAll.addEventListener('click', () => {
  if (!clearConfirmPending) {
    clearConfirmPending = true;
    btnClearAll.textContent = '本当に削除？';
    btnClearAll.classList.add('btn-clear-all--confirm');
    clearConfirmTimer = setTimeout(() => {
      clearConfirmPending = false;
      btnClearAll.textContent = '全削除';
      btnClearAll.classList.remove('btn-clear-all--confirm');
    }, 3000);
  } else {
    clearTimeout(clearConfirmTimer);
    clearConfirmPending = false;
    btnClearAll.textContent = '全削除';
    btnClearAll.classList.remove('btn-clear-all--confirm');
    clearAll();
  }
});

searchInput.addEventListener('input', () => {
  applyFilter(searchInput.value);
});

btnShare.addEventListener('click', () => {
  const text = encodeURIComponent('X のタイムラインに流れた画像を自動保存できる Chrome 拡張機能「X Image Catcher」が便利！スクロールするだけで画像がギャラリーに保存されます 📷 #ChromeExtension');
  chrome.tabs.create({ url: `https://x.com/intent/tweet?text=${text}` });
});

// ---- リアルタイム更新 ----

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.images) return;
  const newImages = changes.images.newValue || [];
  const newIdSet = new Set(newImages.map(i => i.id));

  // ストレージから削除された（trimされた）アイテムをギャラリーからも除去
  const removedIds = allImages.filter(i => !newIdSet.has(i.id)).map(i => i.id);
  for (const id of removedIds) {
    const idx = allImages.findIndex(i => i.id === id);
    if (idx !== -1) allImages.splice(idx, 1);
    const fidx = filteredImages.findIndex(i => i.id === id);
    if (fidx !== -1) {
      if (fidx < renderedCount) renderedCount--;
      filteredImages.splice(fidx, 1);
    }
    gallery.querySelector(`[data-id="${id}"]`)?.remove();
  }

  // 新しく追加されたアイテムを先頭に挿入
  const addedItems = newImages.filter(img => !allImages.some(a => a.id === img.id));
  const query = searchInput.value.trim().toLowerCase();
  for (const item of addedItems) {
    allImages.unshift(item);
    const matchesFilter = !query ||
      (item.authorHandle || '').toLowerCase().includes(query) ||
      (item.authorName || '').toLowerCase().includes(query);
    if (matchesFilter) {
      filteredImages.unshift(item);
      renderedCount++;
      gallery.insertBefore(createCard(item), gallery.firstChild);
    }
  }

  if (addedItems.length === 0 && removedIds.length === 0) return;
  emptyMsg.hidden = filteredImages.length > 0;
  updateCountLabel();
});

init();
