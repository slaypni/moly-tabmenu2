import { h, render } from "preact";
import hotkeys from "hotkeys-js";

const modKey = "ctrl";
const moveDownKey = "w";

function App() {
  console.log("App");

  hotkeys.filter = () => {
    return true;
  };

  hotkeys(`*`, { keyup: true }, event => {
    console.log(`modKey ${hotkeys.isPressed("ctrl")}`);
    switch (event.type) {
      case "keydown":
        console.log("modKey keydown");
        break;
      case "keyup":
        console.log("modKey keyup");
        break;
    }
  });

  hotkeys(`${modKey}+${moveDownKey}`, () => {
    console.log("moveDown");
  });

  return (
    <div id="molytabmenu-app">
      <p>hogeee</p>
    </div>
  );
}

const element = document.createElement("div");
element.id = "molytabmenu-app";
document.body.appendChild(element);
render(<App />, document.getElementById("molytabmenu-app"));
