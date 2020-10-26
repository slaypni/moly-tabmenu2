import hotkeys from "hotkeys-js";
import { Fragment, h, JSX, render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Config, Method, Panel, Sort, Tab } from "./types";

function App() {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [query, setQuery] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [isAutoEnterMode, setIsAutoEnterMode] = useState<boolean>(false);
  const [isModButtonPressed, setIsModButtonPressed] = useState<boolean>(false);
  const [faviconDataUrls, setFaviconDataUrls] = useState<{
    [url: string]: string | null;
  }>({});
  const [config, setConfig] = useState<Config | null>(null);
  const [style, setStyle] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const selectedTabsElementRef = useRef<HTMLDivElement | null>(null);
  const selectedTabElementRef = useRef<HTMLDivElement | null>(null);
  const searchBoxElementRef = useRef<HTMLInputElement | null>(null);
  const sortSelectElementRef = useRef<HTMLSelectElement | null>(null);
  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const rememberLastPanel = false;
  const [appElement] = useState<HTMLElement | null>(
    document.getElementById("molytabmenu")
  );

  const onAnyKeyRef = useRef(null);
  onAnyKeyRef.current = (type: string) => {
    if (isActive) {
      switch (type) {
        case "keyup":
          if (!hotkeys.isPressed(config.modKey) && isAutoEnterMode) {
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
    setIsAutoEnterMode(true);
    containerElementRef.current && containerElementRef.current.focus();
  };

  const onMovePanelKeyRef = useRef(null);
  onMovePanelKeyRef.current = (offset: number) => {
    const panelIndexes = {
      [Panel.Opening]: 0,
      [Panel.Closed]: 1,
      [Panel.History]: 2,
    };
    const panelsCount = Object.keys(panelIndexes).length;

    const i =
      ((panel != null ? panelIndexes[panel] : Panel.Opening) +
        offset +
        panelsCount) %
      panelsCount;
    Object.values(panelIndexes)[i];

    setIsActive(true);
    setPanel(i);
    setIsAutoEnterMode(true);
    containerElementRef.current && containerElementRef.current.focus();
  };

  const onSelectSortKeyRef = useRef(null);
  onSelectSortKeyRef.current = (offset: number) => {
    if (sortSelectElementRef.current) {
      const optionsCount = sortSelectElementRef.current.options.length;
      const i = (sort + offset + optionsCount) % optionsCount;
      setSort(i);
    }
  };

  const onCloseTabKeyRef = useRef(null);
  onCloseTabKeyRef.current = () => {
    if (panel !== Panel.Opening) return;
    closeTab(parseInt(selectedTabElementRef.current.dataset["index"]));
  };

  const onMouseWheelRef = useRef(null);
  onMouseWheelRef.current = (event: WheelEvent) => {
    if (!isModButtonPressed) return;
    setIsActive(true);
    setIndex(index + (event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0));
    setIsAutoEnterMode(true);
    event.preventDefault();
    event.stopPropagation();
  };

  const openTab = (tab: Tab) => {
    chrome.runtime.sendMessage({
      method: Method.OpenTab,
      panel: panel,
      body: panel !== Panel.History ? tab.id : tab.url,
    });
    setIsActive(false);
  };

  const closeTab = (tabId: number) => {
    if (panel !== Panel.Opening) return;
    chrome.runtime.sendMessage({
      method: Method.CloseTab,
      body: tabId,
    });
    const i = tabs.findIndex((t) => t.id === tabId);
    if (i !== -1) {
      const _tabs = [...tabs];
      _tabs.splice(i, 1);
      setTabs(_tabs);
    }
  };

  const getLeafActiveElement = (): Element | null => {
    const _getLeafActiveElement = (activeElement: Element): Element => {
      const childActiveElement =
        activeElement.shadowRoot && activeElement.shadowRoot.activeElement; // todo: use ?.
      return childActiveElement != null
        ? _getLeafActiveElement(childActiveElement)
        : activeElement;
    };
    return (
      document.activeElement && _getLeafActiveElement(document.activeElement)
    );
  };

  const isEditableTargeted = (event: Event): boolean => {
    const eventTarget = event.target as HTMLElement | null;
    const shadowTarget = (eventTarget &&
      eventTarget.shadowRoot &&
      eventTarget.shadowRoot.activeElement) as HTMLElement | null;
    return [eventTarget, shadowTarget]
      .filter((target) => target)
      .some(
        (target) =>
          target.isContentEditable ||
          ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
      );
  };

  useEffect(() => {
    if (!(isActive && style)) return;
    containerElementRef.current.addEventListener("focusout", (e) => {
      const focusedTarget = e.relatedTarget as HTMLElement | null;
      if (
        containerElementRef.current != null &&
        containerElementRef.current.contains(focusedTarget) &&
        containerElementRef.current.contains(e.target as HTMLElement | null)
      )
        return;
      if ((e.target as HTMLElement).contains(focusedTarget)) return;
      setIsActive(false);
    });

    if (!containerElementRef.current.contains(getLeafActiveElement())) {
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
      if (!document.body.contains(appElement)) {
        document.body.prepend(appElement);
      }
    } else {
      setQuery("");
      setTabs([]);
      setIndex(0);
      setPanel(null);
      setSort(null);
      selectedTabElementRef.current = null;
      setIsAutoEnterMode(false);
      setIsInitialized(false);
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
      (tabs) => {
        setTabs(tabs);
        setIsInitialized(true);
      }
    );
  }, [panel, sort, query]);

  useEffect(() => {
    if (isModButtonPressed) return;
    if (!selectedTabElementRef.current) return;
    if (isAutoEnterMode) {
      selectedTabElementRef.current.click();
    }
  }, [isModButtonPressed]);

  useEffect(() => {
    if (config == null) return;

    hotkeys.filter = () => {
      return true;
    };

    hotkeys("*", { keyup: true }, (event) => {
      onAnyKeyRef.current(event.type);
    });

    hotkeys("enter", { keyup: true }, () => {
      if (!selectedTabElementRef.current) return;
      selectedTabElementRef.current.click();
    });

    const bind = (
      keybinds: string[],
      mod: boolean,
      callback: (event: KeyboardEvent) => void
    ) => {
      if (keybinds.length == 0) return () => {};
      const _keybinds = keybinds
        .map((key) => (mod ? `${config.modKey}+` : "") + `${key}`)
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

    bind(config.closeItemKeybinds, true, () => {
      onCloseTabKeyRef.current();
    });

    const shouldBypassEvent = (event: KeyboardEvent): boolean => {
      return (
        isEditableTargeted(event) &&
        !(hotkeys.command || hotkeys.ctrl || hotkeys.alt) &&
        !/^(escape|f\d{1,2})$/i.test(event.key)
      );
    };

    bind(config.focusOnSearchKeybinds, false, (event) => {
      if (shouldBypassEvent(event)) return;
      setIsActive(true);
      setTimeout(() => {
        searchBoxElementRef.current.focus();
      });
    });

    bind(config.selectPrevSortKeybinds, false, (event) => {
      if (shouldBypassEvent(event)) return;
      onSelectSortKeyRef.current(-1);
    });

    bind(config.selectNextSortKeybinds, false, (event) => {
      if (shouldBypassEvent(event)) return;
      onSelectSortKeyRef.current(1);
    });

    bind(config.deactivateKeybinds, false, (event) => {
      if (shouldBypassEvent(event)) return;
      setIsActive(false);
    });

    if (config.mouseModButton != null) {
      const modButton = config.mouseModButton.toLowerCase();

      addEventListener(
        "mousedown",
        (event) => {
          if (modButton !== ["left", "middle", "right"][event.button]) return;
          setIsModButtonPressed(true);
        },
        { capture: true }
      );

      addEventListener(
        "mouseup",
        (event) => {
          if (modButton !== ["left", "middle", "right"][event.button]) return;
          setIsModButtonPressed(false);
        },
        { capture: true }
      );

      addEventListener(
        "wheel",
        (event) => {
          onMouseWheelRef.current(event);
        },
        { capture: true, passive: false }
      );
    }
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
              data-index={tab.id}
            >
              <img
                class={"favicon" + (tab.favIconUrl ? "" : " hidden")}
                src={faviconDataUrls[tab.url] || tab.favIconUrl}
                loading="lazy"
                // @ts-ignore TS2322
                decoding="async"
                width="16"
                height="16"
                onError={() => {
                  if (faviconDataUrls[tab.url] !== undefined) return;
                  chrome.runtime.sendMessage(
                    { method: Method.GetFaviconDataUrl, body: tab.url },
                    (url: string) => {
                      setFaviconDataUrls({
                        ...faviconDataUrls,
                        [tab.url]: url || null,
                      });
                    }
                  );
                }}
              />
              <span class="title">{tab.title}</span>
              <div class="grad"></div>
              {panel === Panel.Opening && isSelected ? (
                <div
                  class="close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id as number);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    <path d="M0 0h24v24H0z" fill="none" />
                  </svg>
                </div>
              ) : null}
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
            setIsAutoEnterMode(false);
          }}
          // @ts-ignore TS2322
          tabindex="-1"
          style={isInitialized ? "" : "opacity: 0"}
        >
          <div class="top">
            <div class="search">
              <input
                type="text"
                placeholder="Search"
                ref={searchBoxElementRef}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                onFocus={() => {
                  setIsAutoEnterMode(false);
                }}
              />
            </div>
            <div class="option">
              <span class="label">sort by</span>
              <div class="select">
                <select
                  value={sort}
                  ref={sortSelectElementRef}
                  onInput={(e) => {
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

const insertApp = () => {
  if (document.getElementById("molytabmenu") != null) return;
  const element = document.createElement("div");
  element.attachShadow({ mode: "open" });
  element.id = "molytabmenu";
  document.body.prepend(element);
  render(<App />, element.shadowRoot);
};

if (document.body != null) {
  insertApp();
} else {
  const observer = new MutationObserver(() => {
    if (document.body != null) {
      observer.disconnect();
      insertApp();
    }
  });

  observer.observe(document, {
    attributes: false,
    attributeOldValue: false,
    characterData: false,
    characterDataOldValue: false,
    childList: true,
    subtree: true,
  });

  document.addEventListener(
    "readystatechange",
    () => {
      switch (document.readyState) {
        case "interactive":
        case "complete":
          insertApp();
      }
    },
    { capture: true }
  );
}
