import hotkeys from "hotkeys-js";
import { h, render, JSX } from "preact";
import { useEffect, useState, useRef } from "preact/hooks";

import { Method, Sort, Message, Panel, Tab, Config } from "./types";

function App() {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [query, setQuery] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const selectedTabElementRef = useRef(null);
  const [isMouseMode, setIsMouseMode] = useState<boolean>(false);
  const [config, setConfig] = useState<Config | null>(null);

  const onAnyKeyRef = useRef(null);
  onAnyKeyRef.current = (type: string) => {
    if (isActive) {
      switch (type) {
        case "keydown":
          // console.log("modKey keydown");
          break;
        case "keyup":
          if (!hotkeys.isPressed(config.modKey) && !isMouseMode) {
            selectedTabElementRef.current.click(); // todo: should use current?.click()
          }
          break;
      }
    }
  };
  const onMoveKeyRef = useRef(null);
  onMoveKeyRef.current = (offset: number) => {
    setIsActive(true);
    setIndex(index + offset);
    setIsMouseMode(false);
  };

  const openTab = (tab: Tab) => {
    chrome.runtime.sendMessage({
      method: Method.OpenTab,
      panel: panel,
      body: panel !== Panel.History ? tab.id : tab.url
    });
    setIsActive(false);
  };

  useEffect(() => {
    setIsActive(true); ////
  }, []);

  useEffect(() => {
    if (isActive) {
      if (panel == null) {
        chrome.runtime.sendMessage({ method: Method.GetLastPanel }, setPanel);
      }
      if (sort == null) {
        chrome.runtime.sendMessage({ method: Method.GetLastSort }, setSort);
      }
    } else {
      setQuery("");
      setTabs([]);
      setIndex(0);
      setPanel(null);
      setSort(null);
      selectedTabElementRef.current = null;
      setIsMouseMode(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (tabs.length) {
      setIndex((tabs.length + index) % tabs.length);
    }
  }, [index, tabs]);

  useEffect(() => {
    if (panel == null) return;
    chrome.runtime.sendMessage({ method: Method.SetLastPanel, body: panel });
  }, [panel]);

  useEffect(() => {
    if (sort == null) return;
    chrome.runtime.sendMessage({ method: Method.SetLastSort, body: sort });
  }, [sort]);

  useEffect(() => {
    if (!isActive || panel == null || sort == null) return;
    chrome.runtime.sendMessage(
      { method: Method.GetTabs, panel: panel, sort: sort, query: query },
      setTabs
    );
  }, [panel, sort, query]);

  useEffect(() => {
    if (config == null) return;

    hotkeys.filter = () => {
      return true;
    };

    hotkeys("*", { keyup: true }, event => {
      // console.log(`modKey ${hotkeys.isPressed("ctrl")}`);
      onAnyKeyRef.current(event.type);
    });

    hotkeys(
      config.moveDownKeybinds.map(key => `${config.modKey}+${key}`).join(","),
      () => {
        // console.log("moveDown");
        onMoveKeyRef.current(1);
      }
    );

    hotkeys(
      config.moveUpKeybinds.map(key => `${config.modKey}+${key}`).join(","),
      () => {
        // console.log("moveUp");
        onMoveKeyRef.current(-1);
      }
    );
  }, [config]);

  useEffect(() => {
    chrome.runtime.sendMessage({ method: Method.GetConfig }, setConfig);
  }, []);

  const getPanelElement = (p: Panel, name: string): JSX.Element => {
    return (
      <div
        class={"molytabmenu-panel" + (p === panel ? " activated" : "")}
        onClick={() => {
          setPanel(p);
        }}
      >
        <span>{name}</span>
      </div>
    );
  };

  const getTabsElement = (): JSX.Element => {
    return (
      <div class="molytabmenu-tabs">
        {tabs.map((tab, i) => {
          const isSelected = index === i;
          return (
            <div
              class={"molytabmenu-tab" + (isSelected ? " selected" : "")}
              key={tab.id.toString()}
              ref={isSelected ? selectedTabElementRef : null}
              onClick={() => {
                if (isActive) {
                  openTab(tab);
                }
              }}
              onMouseMove={() => {
                setIndex(i);
              }}
            >
              <img class="molytabmenu-favicon" src={tab.favIconUrl} />
              <span class="molytabmenu-title">{tab.title}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return isActive ? (
    <div
      class="molytabmenu-container"
      onMouseMove={() => {
        setIsMouseMode(true);
      }}
    >
      <div class="molytabmenu-top">
        <div class="molytabmenu-search">
          <input
            type="text"
            placeholder="Search"
            onInput={e => setQuery((e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="molytabmenu-option">
          <span class="molytabmenu-label">sort by</span>
          <div class="molytabmenu-select">
            <select
              value={sort}
              onInput={e => {
                setSort(parseInt((e.target as HTMLSelectElement).value));
              }}
            >
              <option value={Sort.Active}>Active</option>
              <option value={Sort.ActiveHost}>Active Host</option>
              <option value={Sort.Normal}>Normal</option>
              <option value={Sort.Title}>Title</option>
              <option value={Sort.Url}>URL</option>
            </select>
            <svg focusable="false" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"></path>
            </svg>
          </div>
        </div>
      </div>
      <div class="molytabmenu-category">
        {getPanelElement(Panel.Opening, "Opening")}
        {getPanelElement(Panel.Closed, "Closed")}
        {getPanelElement(Panel.History, "History")}
      </div>
      {getTabsElement()}
    </div>
  ) : null;
}

const element = document.createElement("div");
element.id = "molytabmenu-app";
document.body.appendChild(element);
render(<App />, element);
