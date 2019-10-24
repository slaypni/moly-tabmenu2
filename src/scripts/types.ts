export enum Method {
  GetTabs,
  OpenTab,
  GetLastPanel,
  SetLastPanel,
  GetLastSort,
  SetLastSort,
  GetConfig,
  GetStyle,
  CloseTab
}

export enum Sort {
  Active,
  ActiveHost,
  Normal,
  Title,
  Url
}

export enum Panel {
  Opening,
  Closed,
  History
}

export interface Message {
  method: Method;
  query?: string;
  sort?: Sort;
  panel?: Panel;
  body?: any;
}

export interface Tab {
  id?: number | string;
  title?: string;
  url?: string;
  favIconUrl?: string;
}

export interface Config {
  mouseModButton: string | null;
  modKey: string;
  moveUpKeybinds: string[];
  moveDownKeybinds: string[];
  moveLeftKeybinds: string[];
  moveRightKeybinds: string[];
  closeItemKeybinds: string[];
  focusOnSearchKeybinds: string[];
  selectNextSortKeybinds: string[];
  selectPrevSortKeybinds: string[];
  deactivateKeybinds: string[];
}
