import { groupBy, pick, union, without } from "lodash-es";
import { browser } from "webextension-polyfill-ts";

import { Method, Sort, Message, Panel, Tab, Config } from "./types";

enum State {
  ActivatedTabIds = "ActivatedTabIds",
  LastPanel = "LastPanel",
  LastSort = "LastSort"
}

const MAX_HISTORY_RESULT = 1000;

let style: string | null = null;

async function getStyle(): Promise<string> {
  if (style == null) {
    style = await (await fetch("styles/content.css")).text();
  }
  return style;
}

async function getConfig(): Promise<Config> {
  const cnf = await browser.storage.local.get();
  return Object.assign(
    {},
    ...[
      "mouseModButton",
      "modKey",
      "moveUpKeybinds",
      "moveDownKeybinds",
      "moveLeftKeybinds",
      "moveRightKeybinds",
      "focusOnSearchKeybinds",
      "selectNextSortKeybinds",
      "selectPrevSortKeybinds"
    ].map(k => ({ [k]: cnf[`cnf-${k}`] }))
  );
}

async function clearState(name: string): Promise<void> {
  await browser.storage.local.remove(`st-${name}`);
}

async function getState(name: string): Promise<any> {
  return (await browser.storage.local.get(`st-${name}`))[`st-${name}`];
}

async function setState(name: string, value: any): Promise<void> {
  return await browser.storage.local.set({ [`st-${name}`]: value });
}

async function getActivatedTabIds(): Promise<number[]> {
  return (await getState(State.ActivatedTabIds)) || ([] as number[]); // todo: should use ??
}

async function setActivatedTabIds(value: number[]): Promise<void> {
  return setState(State.ActivatedTabIds, value);
}

browser.runtime.onStartup.addListener(async () => {
  await Promise.all(
    [State.ActivatedTabIds].map(state => {
      clearState(state);
    })
  );
});

browser.tabs.onActivated.addListener(async activeInfo => {
  setActivatedTabIds(
    union([activeInfo.tabId]).concat(await getActivatedTabIds())
  );
});

browser.tabs.onRemoved.addListener(async tabId => {
  setActivatedTabIds(without(await getActivatedTabIds(), tabId));
});

browser.runtime.onMessage.addListener(async (message: Message, sender) => {
  switch (message.method) {
    case Method.GetTabs:
      const doesContainQuery = (tab: Tab): boolean => {
        const query = message.query.toLowerCase();
        return (
          (tab.title || "").toLowerCase().indexOf(query) != -1 ||
          (tab.url || "").toLowerCase().indexOf(query) != -1
        ); // todo: should use ??
      };

      const comp = (a: any, b: any) => (a == b ? 0 : a < b ? -1 : 1);

      const getSortedTabs = async <T extends Tab>(tabs: T[]): Promise<T[]> => {
        const getTabsMap = (): Map<number | string, T> => {
          return new Map(tabs.map(tab => [tab.id, tab]));
        };

        const getTabsInActiveOrder = async (): Promise<T[]> => {
          const tabsMap = getTabsMap();
          return union(
            ((await getActivatedTabIds()) as (number | string)[]).concat(
              tabs.map(tab => tab.id)
            )
          )
            .map(id => {
              return tabsMap.get(id);
            })
            .filter(tab => {
              return tab != null;
            });
        };

        switch (message.sort) {
          case Sort.Active:
            return await getTabsInActiveOrder();
          case Sort.ActiveHost:
            const tabsByHosts = groupBy(tabs, tab => new URL(tab.url).hostname);
            const hosts = union(
              (await getTabsInActiveOrder()).map(
                tab => new URL(tab.url).hostname
              )
            );
            return hosts.flatMap(host => {
              return [...tabsByHosts[host]].sort((a, b) => comp(a.url, b.url));
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
          let tabs = await browser.tabs.query({ currentWindow: true });
          if (message.query) {
            tabs = tabs.filter(doesContainQuery);
          }
          tabs = await getSortedTabs(tabs);
          return tabs.map(tab =>
            pick(tab, ["id", "title", "url", "favIconUrl"])
          );
        }

        case Panel.Closed: {
          let tabs = (await browser.sessions.getRecentlyClosed())
            .filter(session => session.tab)
            .map(session => ({
              id: session.tab.sessionId,
              title: session.tab.title,
              url: session.tab.url,
              favIconUrl: session.tab.favIconUrl,
              windowId: session.tab.windowId
            }));
          return await getSortedTabs(tabs);
        }

        case Panel.History: {
          let items = await browser.history.search({
            text: message.query,
            maxResults: MAX_HISTORY_RESULT
          });
          items = await getSortedTabs(items);
          return items.map(item => pick(item, ["id", "title", "url"]));
        }
      }

    case Method.OpenTab:
      switch (message.panel) {
        case Panel.Opening: {
          const id = message.body as number;
          browser.tabs.update(id, { active: true });
          return;
        }

        case Panel.Closed: {
          const sessionId = message.body as string;
          browser.sessions.restore(sessionId);
          return;
        }

        case Panel.History: {
          const url = message.body as string;
          browser.tabs.create({ url });
          return;
        }
      }

    case Method.GetLastPanel:
      return (await getState(State.LastPanel)) || Panel.Opening; // todo: should use ??

    case Method.SetLastPanel:
      setState(State.LastPanel, message.body);
      return;

    case Method.GetLastSort:
      return (await getState(State.LastSort)) || Sort.Active; // todo: should use ??

    case Method.SetLastSort:
      setState(State.LastSort, message.body);
      return;

    case Method.GetConfig:
      return await getConfig();

    case Method.GetStyle:
      return await getStyle();
  }
});
