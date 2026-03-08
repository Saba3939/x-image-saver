// X Image Catcher — background.js
// バッジのテキスト更新を担当する Service Worker

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_BADGE') {
    const count = message.count || 0;
    const text = count > 0 ? String(count) : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0' });
  }
});
