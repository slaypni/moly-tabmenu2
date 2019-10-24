import hotkeys from "hotkeys-js";
import { h, render, JSX, Fragment } from "preact";
import { useEffect, useState, useRef } from "preact/hooks";

import { Method, Sort, Message, Panel, Tab, Config } from "./types";

function App() {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [query, setQuery] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [isAutoEnterMode, setIsAutoEnterMode] = useState<boolean>(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [style, setStyle] = useState<string>("");
  const selectedTabsElementRef = useRef<HTMLElement | null>(null);
  const selectedTabElementRef = useRef<HTMLElement | null>(null);
  const searchBoxElementRef = useRef<HTMLElement | null>(null);
  const containerElementRef = useRef<HTMLElement | null>(null);
  const rememberLastPanel = false;

  const onAnyKeyRef = useRef(null);
  onAnyKeyRef.current = (type: string) => {
    if (isActive) {
      switch (type) {
        case "keydown":
          // console.log("modKey keydown");
          break;
        case "keyup":
          if (!hotkeys.isPressed(config.modKey) && !isAutoEnterMode) {
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
    setIsAutoEnterMode(false);
  };

  const onMovePanelKeyRef = useRef(null);
  onMovePanelKeyRef.current = (offset: number) => {
    const panelIndexes = {
      [Panel.Opening]: 0,
      [Panel.Closed]: 1,
      [Panel.History]: 2
    };
    const panelCount = Object.keys(panelIndexes).length;

    const i =
      ((panel != null ? panelIndexes[panel] : Panel.Opening) +
        panelCount +
        offset) %
      panelCount;
    Object.values(panelIndexes)[i];

    setIsActive(true);
    setPanel(i);
    setIsAutoEnterMode(false);
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
    if (!(isActive && style)) return;
    containerElementRef.current.addEventListener("focusout", e => {
      //console.log(e.relatedTarget)
      //console.log(e.target)
      const focusedTarget = e.relatedTarget as (HTMLElement | null);
      if (!(e.target as HTMLElement).contains(focusedTarget)) {
        //console.log("deac")
        setIsActive(false);
      }
    });

    // todo: document.activeElement?.shadowRoot?.activeElement
    const focusedElement =
      document.activeElement &&
      document.activeElement.shadowRoot &&
      document.activeElement.shadowRoot.activeElement;

    if (!containerElementRef.current.contains(focusedElement)) {
      containerElementRef.current.focus();
    }
  }, [isActive, style]);

  useEffect(() => {
    if (isActive) {
      if (panel == null) {
        if (rememberLastPanel) {
          chrome.runtime.sendMessage({ method: Method.GetLastPanel }, setPanel);
        } else {
          setPanel(Panel.Opening);
        }
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
      setIsAutoEnterMode(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (tabs.length) {
      setIndex((tabs.length + index) % tabs.length);
    }

    if (tabs.length !== 0) {
      if (selectedTabsElementRef.current && selectedTabElementRef.current) {
        const tabsTop = selectedTabsElementRef.current.offsetTop;
        const tabsHeight = selectedTabsElementRef.current.clientHeight;
        const tabTop = selectedTabElementRef.current.offsetTop - tabsTop;
        const tabHeight = selectedTabElementRef.current.clientHeight;
        const scroll = selectedTabsElementRef.current.scrollTop;

        if (tabTop + tabHeight > scroll + tabsHeight) {
          selectedTabsElementRef.current.scrollTop =
            tabTop + tabHeight - tabsHeight;
        } else if (tabTop - scroll < 0) {
          selectedTabsElementRef.current.scrollTop = tabTop;
        }
      }
    }
  }, [index, tabs]);

  useEffect(() => {
    if (panel == null) return;
    if (rememberLastPanel) {
      chrome.runtime.sendMessage({ method: Method.SetLastPanel, body: panel });
    }
    if (tabs.length != 0) {
      setIndex(0);
    }
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
      onAnyKeyRef.current(event.type);
    });

    const bind = (keybinds: string[], mod: boolean, callback: () => void) => {
      const _keybinds = keybinds
        .map(key => (mod ? `${config.modKey}+` : "") + `${key}`)
        .join(",");
      hotkeys(_keybinds, callback);
      return () => {
        hotkeys.unbind(_keybinds, callback);
      };
    };

    bind(config.moveDownKeybinds, true, () => {
      onMoveKeyRef.current(1);
    });

    bind(config.moveUpKeybinds, true, () => {
      onMoveKeyRef.current(-1);
    });

    bind(config.moveLeftKeybinds, true, () => {
      onMovePanelKeyRef.current(-1);
    });

    bind(config.moveRightKeybinds, true, () => {
      onMovePanelKeyRef.current(1);
    });

    bind(config.focusOnSearchKeybinds, false, () => {
      setIsActive(true);
      setTimeout(() => {
        searchBoxElementRef.current.focus();
      });
    });

    bind(config.deactivateKeybinds, false, () => {
      setIsActive(false);
    });
  }, [config]);

  useEffect(() => {
    chrome.runtime.sendMessage({ method: Method.GetConfig }, setConfig);
    chrome.runtime.sendMessage({ method: Method.GetStyle }, setStyle);
  }, []);

  const getPanelElement = (p: Panel, name: string): JSX.Element => {
    return (
      <div
        class={"panel" + (p === panel ? " activated" : "")}
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
      <div class="tabs" ref={selectedTabsElementRef}>
        {tabs.map((tab, i) => {
          const isSelected = index === i;
          return (
            <div
              class={"tab" + (isSelected ? " selected" : "")}
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
              <img
                class={"favicon" + (tab.favIconUrl ? "" : " hidden")}
                src={tab.favIconUrl}
                // @ts-ignore TS2322
                loading="lazy"
                decoding="async"
              />
              <span class="title">{tab.title}</span>
              <div class="grad"></div>
            </div>
          );
        })}
      </div>
    );
  };

  return isActive && style ? (
    <Fragment>
      <style>{style}</style>
      <div id="molytabmenu-app">
        <div
          class="container"
          ref={containerElementRef}
          onMouseMove={() => {
            setIsAutoEnterMode(true);
          }}
          // @ts-ignore TS2322
          tabindex="-1"
        >
          <div class="top">
            <div class="search">
              <input
                type="text"
                placeholder="Search"
                ref={searchBoxElementRef}
                onInput={e => setQuery((e.target as HTMLInputElement).value)}
                onFocus={() => {
                  setIsAutoEnterMode(true);
                }}
              />
            </div>
            <div class="option">
              <span class="label">sort by</span>
              <div class="select">
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
          <div class="category">
            {getPanelElement(Panel.Opening, "Opening")}
            {getPanelElement(Panel.Closed, "Closed")}
            {getPanelElement(Panel.History, "History")}
          </div>
          {getTabsElement()}
        </div>
      </div>
    </Fragment>
  ) : null;
}

const element = document.createElement("div");
element.attachShadow({ mode: "open" });
element.id = "molytabmenu";
document.body.appendChild(element);
render(<App />, element.shadowRoot);
