import hotkeys, { KeyHandler } from "hotkeys-js";
import { isEqual, union } from "lodash-es";
import { h, render, Fragment, Ref } from "preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { browser } from "webextension-polyfill-ts";

const keyNames = {
  8: "backspace",
  9: "tab",
  13: "enter",
  27: "esc",
  32: "space",
  33: "pageup",
  34: "pagedown",
  35: "end",
  36: "home",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  46: "delete",
  112: "f1",
  113: "f2",
  114: "f3",
  115: "f4",
  116: "f5",
  117: "f6",
  118: "f7",
  119: "f8",
  120: "f9",
  121: "f10",
  122: "f11",
  123: "f12",
  124: "f13",
  125: "f14",
  126: "f15",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
};

enum Mod {
  Meta = "command",
  Ctrl = "ctrl",
  Alt = "alt",
  Shift = "shift"
}

function App() {
  const [mouseModButton, setMouseModButton] = useState<string | null>(null);
  const [modKey, setModKey] = useState<string | null>(Mod.Ctrl);
  const [theme, setTheme] = useState<string>("light");
  const [moveUpKeybinds, setMoveUpKeybinds] = useState([]);
  const [moveDownKeybinds, setMoveDownKeybinds] = useState([]);
  const [moveLeftKeybinds, setMoveLeftKeybinds] = useState([]);
  const [moveRightKeybinds, setMoveRightKeybinds] = useState([]);
  const [closeItemKeybinds, setCloseItemKeybinds] = useState([]);
  const [focusOnSearchKeybinds, setFocusOnSearchKeybinds] = useState([]);
  const [selectNextSortKeybinds, setSelectNextSortKeybinds] = useState([]);
  const [selectPrevSortKeybinds, setSelectPrevSortKeybinds] = useState([]);
  const [deactivateKeybinds, setDeactivateKeybinds] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      const cnf = await browser.storage.local.get();
      for (let [kv, setState] of [
        [{ mouseModButton }, setMouseModButton],
        [{ modKey }, setModKey],
        [{ theme }, setTheme],
        [{ moveUpKeybinds }, setMoveUpKeybinds],
        [{ moveDownKeybinds }, setMoveDownKeybinds],
        [{ moveLeftKeybinds }, setMoveLeftKeybinds],
        [{ moveRightKeybinds }, setMoveRightKeybinds],
        [{ closeItemKeybinds }, setCloseItemKeybinds],
        [{ focusOnSearchKeybinds }, setFocusOnSearchKeybinds],
        [{ selectNextSortKeybinds }, setSelectNextSortKeybinds],
        [{ selectPrevSortKeybinds }, setSelectPrevSortKeybinds],
        [{ deactivateKeybinds }, setDeactivateKeybinds]
      ]) {
        const key = `cnf-${Object.keys(kv)[0]}`;
        const value = Object.values(kv)[0];
        (setState as any)(cnf[key] || value);
      }
      setInitialized(true);
    })();
  }, []);

  for (let [key, value] of Object.entries({
    mouseModButton,
    modKey,
    theme,
    moveUpKeybinds,
    moveDownKeybinds,
    moveLeftKeybinds,
    moveRightKeybinds,
    closeItemKeybinds,
    focusOnSearchKeybinds,
    selectNextSortKeybinds,
    selectPrevSortKeybinds,
    deactivateKeybinds
  })) {
    useEffect(() => {
      if (!initialized) return;
      browser.storage.local.set({ [`cnf-${key}`]: value });
    }, [value]);
  }

  const message = new URLSearchParams(window.location.search).get("message");

  return (
    <div id="app">
      {message ? (
        <div class="message">
          <span>{message}</span>
        </div>
      ) : null}
      <div class="title">
        <span class="moly">Moly</span>
        <span class="tabmenu">TabMenu</span>
      </div>

      <div class="subtitle">
        <h2>Configurations</h2>
      </div>

      <form class="pure-form">
        <fieldset>
          <div class="item pure-g">
            <div class="description pure-u-2-5">
              <span>Use mouse scroll for item selection</span>
            </div>
            <div class="content pure-u-3-5">
              <select
                value={mouseModButton || "disable"}
                onInput={e => {
                  const value = (e.target as HTMLSelectElement).value;
                  setMouseModButton(value != "disable" ? value : null);
                }}
              >
                <option value="disable">disable</option>
                <option value="left">while left button is pressed</option>
                <option value="middle">while middle button is pressed</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <div class="item pure-g">
            <div class="description pure-u-2-5">
              <span>Modifier key for hot keys</span>
            </div>
            <div class="content pure-u-3-5">
              <select
                value={modKey}
                onInput={e => {
                  setModKey((e.target as HTMLSelectElement).value);
                }}
              >
                <option value={Mod.Meta}>{Mod.Meta} ()</option>
                <option value={Mod.Ctrl}>{Mod.Ctrl}</option>
                <option value={Mod.Alt}>{Mod.Alt}</option>
                <option value={Mod.Shift}>{Mod.Shift}</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <div class="item pure-g">
            <div class="description pure-u-2-5">
              <span>Color theme</span>
            </div>
            <div class="content pure-u-3-5">
              <select
                value={theme || "light"}
                onInput={e => {
                  setTheme((e.target as HTMLSelectElement).value);
                }}
              >
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </div>
          </div>
        </fieldset>
      </form>

      <div class="subtitle">
        <h2>Hot keys</h2>
      </div>

      <form class="pure-form">
        {[
          {
            label: "Select next item",
            keybinds: moveDownKeybinds,
            setKeybinds: setMoveDownKeybinds,
            mod: true
          },
          {
            label: "Select previous item",
            keybinds: moveUpKeybinds,
            setKeybinds: setMoveUpKeybinds,
            mod: true
          },
          {
            label: "Move to right pane",
            keybinds: moveRightKeybinds,
            setKeybinds: setMoveRightKeybinds,
            mod: true
          },
          {
            label: "Move to left pane",
            keybinds: moveLeftKeybinds,
            setKeybinds: setMoveLeftKeybinds,
            mod: true
          },
          {
            label: "Close selected tab",
            keybinds: closeItemKeybinds,
            setKeybinds: setCloseItemKeybinds,
            mod: true
          },
          {
            label: "Focus on search box",
            keybinds: focusOnSearchKeybinds,
            setKeybinds: setFocusOnSearchKeybinds,
            mod: false
          },
          {
            label: "Select next sort option",
            keybinds: selectNextSortKeybinds,
            setKeybinds: setSelectNextSortKeybinds,
            mod: false
          },
          {
            label: "Select previous sort option",
            keybinds: selectPrevSortKeybinds,
            setKeybinds: setSelectPrevSortKeybinds,
            mod: false
          },
          {
            label: "Close menu",
            keybinds: deactivateKeybinds,
            setKeybinds: setDeactivateKeybinds,
            mod: false
          }
        ].map(({ label, keybinds, setKeybinds, mod }) => (
          <fieldset>
            <div class="item pure-g">
              <div class="description pure-u-2-5">
                <span>{label}</span>
              </div>
              <div class="content pure-u-3-5">
                <BindButtons
                  modKey={mod ? modKey : null}
                  keybinds={keybinds}
                  setKeybinds={setKeybinds}
                />
              </div>
            </div>
          </fieldset>
        ))}
      </form>
    </div>
  );
}

function BindButton({
  modKey,
  keybind,
  setKeybind,
  isActive,
  setIsActive,
  elementRef
}: {
  modKey: string | null;
  keybind: string | null;
  setKeybind: (keybind: string | null) => void;
  isActive: boolean;
  setIsActive: (isActive: boolean) => void;
  elementRef: Ref<HTMLElement | null>;
}) {
  const deleteButtonElementRef = useRef<HTMLElement | null>(null);
  const splitKey = "+";

  const sanitize = (bind: string): string =>
    bind
      .split(splitKey)
      .filter(key => key !== modKey)
      .join(splitKey);

  useEffect(() => {
    const handler: KeyHandler = event => {
      if (!isActive) return;
      const key = event.key.toLowerCase();
      if (["meta", "control", "alt", "shift"].includes(key)) return;
      const mods = []
        .concat(event.metaKey ? [Mod.Meta] : [])
        .concat(event.ctrlKey ? [Mod.Ctrl] : [])
        .concat(event.altKey ? [Mod.Alt] : [])
        .concat(event.shiftKey ? [Mod.Shift] : []);
      const code = event.keyCode || event.which || event.charCode;
      const rawKey = keyNames[code] || String.fromCharCode(code).toLowerCase();
      const newbind = sanitize(mods.concat([rawKey]).join(splitKey));
      setKeybind(newbind);
      setIsActive(false);
    };
    hotkeys("*", handler);
    return () => {
      hotkeys.unbind("*", handler);
    };
  }, [isActive]);

  useEffect(() => {
    if (keybind == null) return;
    const newbind = sanitize(keybind);
    if (!isEqual(keybind, newbind)) {
      setKeybind(newbind);
    }
  }, [modKey]);

  return (
    <Fragment>
      <button
        class={
          "pure-button keybind" +
          (isActive ? " active" : "") +
          (keybind == null ? " undefined" : "")
        }
        type="button"
        ref={elementRef}
        onClick={() => {
          setIsActive(true);
        }}
        onBlur={() => {
          if (!isActive) return;
          setTimeout(() => {
            if (document.activeElement != deleteButtonElementRef.current) {
              setIsActive(false);
            }
          });
        }}
      >
        <span>
          {modKey ? (
            <Fragment>
              <i>{modKey}</i>
              {splitKey}
            </Fragment>
          ) : keybind ? null : (
            <Fragment>&nbsp;</Fragment>
          )}
          {keybind}
        </span>
      </button>
      {isActive && keybind != null ? (
        <button
          class="pure-button keybind-delete active"
          type="button"
          ref={deleteButtonElementRef}
          onClick={() => {
            setKeybind(null);
            setIsActive(false);
          }}
        >
          <span>x</span>
        </button>
      ) : null}
    </Fragment>
  );
}

function BindButtons({
  modKey,
  keybinds,
  setKeybinds
}: {
  modKey: string | null;
  keybinds: string[];
  setKeybinds: (keybinds: string[]) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeButtonElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const newbinds = union(keybinds);
    if (!isEqual(keybinds, newbinds)) {
      setKeybinds(newbinds);
    }
  }, [keybinds]);

  return (
    <Fragment>
      {keybinds.map((keybind, i) => {
        return (
          <BindButton
            modKey={modKey}
            keybind={keybind}
            setKeybind={(keybind: string | null) => {
              const _keybinds = [...keybinds];
              if (keybind != null) {
                _keybinds[i] = keybind;
              } else {
                _keybinds.splice(i, 1);
              }
              setKeybinds(_keybinds);
            }}
            isActive={i == activeIndex}
            setIsActive={(isActive: boolean) => {
              setActiveIndex(isActive ? i : null);
            }}
            elementRef={i == activeIndex ? activeButtonElementRef : null}
          />
        );
      })}
      {activeIndex == -1 ? (
        <BindButton
          modKey={modKey}
          keybind={null}
          setKeybind={(keybind: string | null) => {
            setKeybinds(keybinds.concat([keybind]));
          }}
          isActive={true}
          setIsActive={(isActive: boolean) => {
            setActiveIndex(isActive ? -1 : null);
          }}
          elementRef={activeButtonElementRef}
        />
      ) : null}
      <button
        class="pure-button keybind-add"
        type="button"
        key={"+"}
        onClick={() => {
          setActiveIndex(-1);
        }}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement != activeButtonElementRef.current) {
              setActiveIndex(null);
            }
          });
        }}
      >
        <span>+</span>
      </button>
    </Fragment>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  render(<App />, document.getElementById("root"));
});
