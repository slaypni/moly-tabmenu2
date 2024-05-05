import { groupBy, pick, union, without } from "lodash-es";
import { LRUMap } from "lru_map";
import { Config, Message, Method, Panel, Sort, Tab } from "./types";

enum State {
  ActivatedTabIds = "ActivatedTabIds",
  LastPanel = "LastPanel",
  LastSort = "LastSort",
}

const MAX_HISTORY_RESULT = 200;
const MAX_FAVICON_DATA_CACHE = 1000;

let _styles = {};

async function getStyle(): Promise<string> {
  const theme = (await chrome.storage.local.get("cnf-theme"))["cnf-theme"];
  if (_styles[theme] == null) {
    _styles[theme] = await (
      await fetch(chrome.runtime.getURL(`content-${theme}.css`))
    ).text();
  }
  return _styles[theme];
}

async function getConfig(): Promise<Config> {
  const cnf = await chrome.storage.local.get();
  return Object.assign(
    {},
    ...[
      "mouseModButton",
      "modKey",
      "moveUpKeybinds",
      "moveDownKeybinds",
      "moveLeftKeybinds",
      "moveRightKeybinds",
      "closeItemKeybinds",
      "focusOnSearchKeybinds",
      "selectNextSortKeybinds",
      "selectPrevSortKeybinds",
      "deactivateKeybinds",
    ].map((k) => ({ [k]: cnf[`cnf-${k}`] }))
  );
}

async function clearState(name: string): Promise<void> {
  await chrome.storage.local.remove(`st-${name}`);
}

async function getState(name: string): Promise<any> {
  return (await chrome.storage.local.get(`st-${name}`))[`st-${name}`];
}

async function setState(name: string, value: any): Promise<void> {
  return await chrome.storage.local.set({ [`st-${name}`]: value });
}

async function getActivatedTabIds(): Promise<number[]> {
  return (
    (await chrome.storage.session.get("activatedTabIds"))["activatedTabIds"] ??
    []
  );
}

async function setActivatedTabIds(value: number[]): Promise<void> {
  await chrome.storage.session.set({ activatedTabIds: [...value] });
}

const _dataUrlCache = new LRUMap(MAX_FAVICON_DATA_CACHE);

async function toDataUrl(url: string): Promise<string | null> {
  const cached = _dataUrlCache.get(url);
  if (cached !== undefined) return cached as string | null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _dataUrlCache.set(url, reader.result);
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching the URL:", error);
    return null;
  }
}

async function getFaviconDataUrl(url: string) {
  return toDataUrl(
    `chrome-extension://${
      chrome.runtime.id
    }/_favicon/?pageUrl=${encodeURIComponent(url)}`
  );
}

chrome.runtime.onInstalled.addListener(async () => {
  const config = (await chrome.storage.local.get()) as {};
  const isClean = Object.keys(config).length === 0;
  const version = config["cnf-version"] || 0;
  let message = "";

  if (version === 0) {
    chrome.storage.local.clear();
  }

  if (version < 1) {
    Object.entries({
      version: 1,
      mouseModButton: null,
      modKey: "ctrl",
      moveUpKeybinds: ["shift+q"],
      moveDownKeybinds: ["q"],
      moveLeftKeybinds: [],
      moveRightKeybinds: [],
      closeItemKeybinds: [],
      focusOnSearchKeybinds: ["ctrl+'"],
      selectNextSortKeybinds: [],
      selectPrevSortKeybinds: [],
      deactivateKeybinds: ["esc"],
    }).forEach(([key, value]) => {
      chrome.storage.local.set({ [`cnf-${key}`]: value });
    });

    if (!isClean) {
      message =
        "MolyTabMenu got a major upgrade! Please set up hotkeys as you like!";
    }
    const url = chrome.runtime.getURL("options.html");
    chrome.tabs.create({
      url: `${url}${message ? `?message=${message}` : ""}`,
    });
  }

  if (version < 2) {
    Object.entries({
      version: 2,
      theme: "light",
    }).forEach(([key, value]) => {
      chrome.storage.local.set({ [`cnf-${key}`]: value });
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await Promise.all(
    [State.ActivatedTabIds].map((state) => {
      clearState(state);
    })
  );
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  setActivatedTabIds(
    union([activeInfo.tabId].concat(await getActivatedTabIds()))
  );
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  setActivatedTabIds(without(await getActivatedTabIds(), tabId));
});

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    (async () => {
      switch (message.method) {
        case Method.GetTabs:
          const doesContainQuery = (tab: Tab): boolean => {
            const query = message.query.toLowerCase();
            return (
              (tab.title ?? "").toLowerCase().indexOf(query) != -1 ||
              (tab.url ?? "").toLowerCase().indexOf(query) != -1
            );
          };

          const comp = (a: any, b: any) => (a == b ? 0 : a < b ? -1 : 1);

          const getSortedTabs = async <T extends Tab>(
            tabs: T[]
          ): Promise<T[]> => {
            const getTabsMap = (): Map<number | string, T> => {
              return new Map(tabs.map((tab) => [tab.id, tab]));
            };

            const getTabsInActiveOrder = async (): Promise<T[]> => {
              const tabsMap = getTabsMap();
              return union(
                ((await getActivatedTabIds()) as (number | string)[]).concat(
                  tabs.map((tab) => tab.id)
                )
              )
                .map((id) => {
                  return tabsMap.get(id);
                })
                .filter((tab) => {
                  return tab != null;
                });
            };

            switch (message.sort) {
              case Sort.Active:
                return await getTabsInActiveOrder();
              case Sort.ActiveHost:
                const tabsInActivateOrder = await getTabsInActiveOrder();
                const tabsByHosts = groupBy(
                  tabsInActivateOrder,
                  (tab) => new URL(tab.url).hostname
                );
                const hosts = union(
                  tabsInActivateOrder.map((tab) => new URL(tab.url).hostname)
                );
                return hosts.flatMap((host) => {
                  return tabsByHosts[host];
                });
              case Sort.Title:
                return [...tabs].sort((a, b) =>
                  comp(a.title.toLowerCase(), b.title.toLowerCase())
                );
              case Sort.Url:
                return [...tabs].sort((a, b) =>
                  comp(a.url.toLowerCase(), b.url.toLowerCase())
                );
            }
            return tabs;
          };

          switch (message.panel) {
            case Panel.Opening: {
              let tabs = await chrome.tabs.query({ currentWindow: true });
              if (message.query) {
                tabs = tabs.filter(doesContainQuery);
              }
              tabs = await getSortedTabs(tabs);
              sendResponse(
                tabs.map((tab) =>
                  pick(tab, ["id", "title", "url", "favIconUrl"])
                )
              );
              return;
            }

            case Panel.Closed: {
              let tabs = (await chrome.sessions.getRecentlyClosed())
                .filter((session) => session.tab)
                .map((session) => ({
                  id: session.tab.sessionId,
                  title: session.tab.title,
                  url: session.tab.url,
                  favIconUrl: session.tab.favIconUrl,
                  windowId: session.tab.windowId,
                }));
              if (message.query) {
                tabs = tabs.filter(doesContainQuery);
              }
              sendResponse(await getSortedTabs(tabs));
              return;
            }

            case Panel.History: {
              const searchable = message.query.length >= 3;
              let items = await chrome.history.search({
                text: searchable ? message.query : "",
                maxResults: MAX_HISTORY_RESULT,
              });
              if (!searchable) {
                items = items.filter(doesContainQuery);
              }
              items = await getSortedTabs(items);
              sendResponse(
                await Promise.all(
                  items.map(async (item) =>
                    Object.assign(
                      {
                        favIconUrl: await getFaviconDataUrl(item.url),
                      },
                      pick(item, ["id", "title", "url"])
                    )
                  )
                )
              );
              return;
            }
          }

        case Method.OpenTab:
          switch (message.panel) {
            case Panel.Opening: {
              const id = message.body as number;
              chrome.tabs.update(id, { active: true });
              return;
            }

            case Panel.Closed: {
              const sessionId = message.body as string;
              chrome.sessions.restore(sessionId);
              return;
            }

            case Panel.History: {
              const url = message.body as string;
              chrome.tabs.create({ url });
              return;
            }
          }

        case Method.GetLastPanel:
          sendResponse((await getState(State.LastPanel)) ?? Panel.Opening);
          return;

        case Method.SetLastPanel:
          setState(State.LastPanel, message.body);
          return;

        case Method.GetLastSort:
          sendResponse((await getState(State.LastSort)) ?? Sort.Active);
          return;

        case Method.SetLastSort:
          setState(State.LastSort, message.body);
          return;

        case Method.GetConfig:
          sendResponse(await getConfig());
          return;

        case Method.GetStyle:
          sendResponse(await getStyle());
          return;

        case Method.CloseTab:
          chrome.tabs.remove(message.body);
          return;

        case Method.GetFaviconDataUrl:
          sendResponse(await getFaviconDataUrl(message.body));
          return;
      }
    })();
    return true;
  }
);
