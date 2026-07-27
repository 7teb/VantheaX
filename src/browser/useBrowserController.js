import { useCallback, useEffect, useReducer, useRef } from "react";

const createId = () => `browser-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 9)}`;

const createTab = (id = createId(), initialUrl = "about:blank") => ({
  id,
  initialUrl,
  url: initialUrl,
  pendingUrl: null,
  title: "",
  loading: false,
  canBack: false,
  canForward: false,
  error: "",
});

const reducer = (state, action) => {
  if (action.type === "add") {
    if (state.tabs.some((tab) => tab.id === action.id)) {
      return { ...state, activeId: action.id };
    }
    const tab = createTab(action.id, action.url);
    return { tabs: [...state.tabs, tab], activeId: tab.id };
  }
  if (action.type === "close") {
    const index = state.tabs.findIndex((tab) => tab.id === action.id);
    const tabs = state.tabs.filter((tab) => tab.id !== action.id);
    const activeId = state.activeId === action.id
      ? tabs[Math.min(Math.max(0, index), tabs.length - 1)]?.id || ""
      : state.activeId;
    return { tabs, activeId };
  }
  if (action.type === "select") {
    return state.tabs.some((tab) => tab.id === action.id) ? { ...state, activeId: action.id } : state;
  }
  if (action.type === "patch") {
    return {
      ...state,
      tabs: state.tabs.map((tab) => tab.id === action.id ? { ...tab, ...action.patch } : tab),
    };
  }
  if (action.type === "reset") {
    const tab = createTab();
    return { tabs: [tab], activeId: tab.id };
  }
  return state;
};

const initialState = () => {
  const tab = createTab();
  return { tabs: [tab], activeId: tab.id };
};

export const useBrowserController = ({ api, onOpen }) => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  const guests = useRef(new Map());
  const registered = useRef(new Set());
  const activeConfirmed = useRef("");
  const waiters = useRef(new Set());
  const commandQueue = useRef(Promise.resolve());
  const openRef = useRef(onOpen);

  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  const notify = useCallback(() => {
    for (const waiter of waiters.current) {
      waiter();
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
    notify();
  }, [notify, state]);

  const waitUntil = useCallback((predicate, timeout = 11000) => new Promise((resolve, reject) => {
    const started = Date.now();
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      if (predicate()) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() - started >= timeout) {
        cleanup();
        reject(new Error("Browser renderer command timed out."));
        return;
      }
      timer = window.setTimeout(check, 50);
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      waiters.current.delete(check);
    };
    waiters.current.add(check);
    check();
  }), []);

  const confirmActive = useCallback(async (id) => {
    if (!id || !registered.current.has(id)) {
      return false;
    }
    const result = await api.setActiveBrowserTab({ tabId: id });
    if (!result?.ok) {
      return false;
    }
    activeConfirmed.current = id;
    notify();
    return true;
  }, [api, notify]);

  useEffect(() => {
    activeConfirmed.current = "";
    confirmActive(state.activeId).catch(() => {});
  }, [confirmActive, state.activeId]);

  const patchTab = useCallback((id, patch) => {
    dispatch({ type: "patch", id, patch });
  }, []);

  const attachGuest = useCallback(async (id, guest) => {
    guests.current.set(id, guest);
    let webContentsId = 0;
    try {
      webContentsId = guest.getWebContentsId();
    } catch {}
    if (!webContentsId) {
      return false;
    }
    const result = await api.registerBrowserTab({ tabId: id, webContentsId });
    if (!result?.ok) {
      guests.current.delete(id);
      return false;
    }
    registered.current.add(id);
    notify();
    if (stateRef.current.activeId === id) {
      await confirmActive(id);
    }
    return true;
  }, [api, confirmActive, notify]);

  const detachGuest = useCallback(async (id, guest) => {
    if (guests.current.get(id) === guest) {
      guests.current.delete(id);
    }
    registered.current.delete(id);
    if (activeConfirmed.current === id) {
      activeConfirmed.current = "";
    }
    notify();
    try {
      await api.unregisterBrowserTab({ tabId: id });
    } catch {}
    notify();
  }, [api, notify]);

  const addTab = useCallback((url = "about:blank", id = createId()) => {
    dispatch({ type: "add", id, url });
    return id;
  }, []);

  const selectTab = useCallback((id) => {
    dispatch({ type: "select", id });
  }, []);

  const removeTab = useCallback((id) => {
    dispatch({ type: "close", id });
  }, []);

  const runGuestAction = useCallback((id, action) => {
    const guest = guests.current.get(id);
    if (!guest || !registered.current.has(id)) {
      return false;
    }
    try {
      action(guest);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadTab = useCallback((id, url) => {
    const loaded = runGuestAction(id, (guest) => guest.loadURL(url).catch(() => {}));
    if (loaded) {
      patchTab(id, { pendingUrl: null, error: "" });
    }
    return loaded;
  }, [patchTab, runGuestAction]);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => api.onBrowserCommand((command) => {
    commandQueue.current = commandQueue.current.catch(() => {}).then(async () => {
      const requestId = String(command?.requestId || "");
      try {
        const action = String(command?.action || "");
        if (action === "new") {
          openRef.current();
          addTab(String(command.url || "about:blank"), String(command.tabId || createId()));
          await waitUntil(() => {
            const current = stateRef.current;
            return current.activeId === command.tabId
              && registered.current.has(command.tabId)
              && activeConfirmed.current === command.tabId;
          });
        } else if (action === "select") {
          openRef.current();
          selectTab(String(command.tabId || ""));
          await waitUntil(() => {
            const current = stateRef.current;
            return current.activeId === command.tabId
              && registered.current.has(command.tabId)
              && activeConfirmed.current === command.tabId;
          });
        } else if (action === "close") {
          removeTab(String(command.tabId || ""));
          await waitUntil(() => !stateRef.current.tabs.some((tab) => tab.id === command.tabId) && !registered.current.has(command.tabId));
        } else {
          throw new Error(`Unknown browser renderer command: ${action}`);
        }
        await api.resolveBrowserCommand({ requestId, ok: true, tabId: command.tabId || "" });
      } catch (error) {
        await api.resolveBrowserCommand({ requestId, ok: false, tabId: command?.tabId || "", error: String(error?.message || error) });
      }
    });
  }), [addTab, api, removeTab, selectTab, waitUntil]);

  return {
    state,
    activeIdRef: stateRef,
    addTab,
    attachGuest,
    detachGuest,
    loadTab,
    patchTab,
    removeTab,
    reset,
    runGuestAction,
    selectTab,
  };
};
