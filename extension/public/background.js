const DEFAULT_API = "http://localhost:5000/api";
const DEFAULT_BLOCKED = [
  "youtube.com",
  "instagram.com",
  "reddit.com",
  "x.com",
  "facebook.com",
];
function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
async function state() {
  const x = await chrome.storage.local.get([
    "focusActive",
    "focusTask",
    "focusEnd",
    "blockedDomains",
    "apiBase",
  ]);
  return {
    ...x,
    blockedDomains: x.blockedDomains?.length
      ? x.blockedDomains
      : DEFAULT_BLOCKED,
    apiBase: x.apiBase || DEFAULT_API,
  };
}
async function nudge(tab) {
  const s = await state();
  if (!s.focusActive || !tab?.url) return;
  const h = host(tab.url);
  if (!h) return;
  const blocked = s.blockedDomains.some((d) => h === d || h.endsWith("." + d));
  if (!blocked) return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "FOCUS_NUDGE",
      task: s.focusTask || "your focus task",
    });
  } catch {}
}
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    apiBase: DEFAULT_API,
    blockedDomains: DEFAULT_BLOCKED,
    focusActive: false,
  });
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await nudge(tab);
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") await nudge(tab);
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "focusflow-end") return;
  await chrome.storage.local.set({ focusActive: false, focusEnd: null });
  try {
    await chrome.notifications?.create?.("focusflow-done", {
      type: "basic",
      iconUrl: "icon.png",
      title: "FocusFlow",
      message: "Focus session complete. Take a small break.",
    });
  } catch {}
});
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    if (msg.type === "SET_FOCUS") {
      await chrome.storage.local.set({
        focusActive: true,
        focusTask: msg.task,
        focusEnd: msg.end,
      });
      await chrome.alarms.create("focusflow-end", { when: msg.end });
    }
    if (msg.type === "STOP_FOCUS") {
      await chrome.storage.local.set({ focusActive: false, focusEnd: null });
      await chrome.alarms.clear("focusflow-end");
    }
    sendResponse({ ok: true });
  })();
  return true;
});
