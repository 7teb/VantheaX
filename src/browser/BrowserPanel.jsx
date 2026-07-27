import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Plus, RotateCw, X } from "lucide-react";
import { displayBrowserUrl, normalizeBrowserUrl } from "./browser-url.js";

const createTab = (id, initialUrl = "about:blank") => ({
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

const browserReducer = (state, action) => {
  if (action.type === "add") {
    const tab = createTab(action.id, action.url);
    return { tabs: [...state.tabs, tab], activeId: tab.id };
  }
  if (action.type === "close") {
    const index = state.tabs.findIndex((tab) => tab.id === action.id);
    const tabs = state.tabs.filter((tab) => tab.id !== action.id);
    const activeId = state.activeId === action.id
      ? tabs[Math.min(index, tabs.length - 1)]?.id || 0
      : state.activeId;
    return { tabs, activeId };
  }
  if (action.type === "select") {
    return { ...state, activeId: action.id };
  }
  if (action.type === "patch") {
    return {
      ...state,
      tabs: state.tabs.map((tab) => tab.id === action.id ? { ...tab, ...action.patch } : tab),
    };
  }
  return state;
};

const initialBrowserState = () => ({
  tabs: [createTab(1)],
  activeId: 1,
});

const BrowserView = ({ tab, active, activeIdRef, urlFocusRef, onPatch, onAttached, onDetached, loadFailed }) => {
  const guestRef = useRef(null);

  useLayoutEffect(() => {
    const guest = guestRef.current;
    if (!guest) {
      return;
    }
    const historyState = () => {
      try {
        onPatch(tab.id, {
          canBack: guest.canGoBack(),
          canForward: guest.canGoForward(),
        });
      } catch {}
    };
    const acceptNavigation = (event) => {
      const patch = { url: event.url, error: "" };
      if (tab.id !== activeIdRef.current || !urlFocusRef.current) {
        patch.pendingUrl = null;
      }
      onPatch(tab.id, patch);
      historyState();
    };
    const acceptInPageNavigation = (event) => {
      if (event.isMainFrame) {
        acceptNavigation(event);
      }
    };
    const handleAttach = () => {
      onAttached(tab.id, guest);
      historyState();
    };
    const handleStart = () => onPatch(tab.id, { loading: true, error: "" });
    const handleStop = () => {
      onPatch(tab.id, { loading: false });
      historyState();
    };
    const handleTitle = (event) => onPatch(tab.id, { title: event.title || "" });
    const handleFail = (event) => {
      if (event.isMainFrame && event.errorCode !== -3) {
        onPatch(tab.id, {
          loading: false,
          url: event.validatedURL || tab.initialUrl,
          pendingUrl: null,
          error: event.errorDescription || loadFailed,
        });
      }
    };
    const handleGone = () => onPatch(tab.id, { loading: false, error: loadFailed });
    guest.addEventListener("did-attach", handleAttach);
    guest.addEventListener("did-start-loading", handleStart);
    guest.addEventListener("did-stop-loading", handleStop);
    guest.addEventListener("did-navigate", acceptNavigation);
    guest.addEventListener("did-navigate-in-page", acceptInPageNavigation);
    guest.addEventListener("page-title-updated", handleTitle);
    guest.addEventListener("did-fail-load", handleFail);
    guest.addEventListener("render-process-gone", handleGone);
    return () => {
      guest.removeEventListener("did-attach", handleAttach);
      guest.removeEventListener("did-start-loading", handleStart);
      guest.removeEventListener("did-stop-loading", handleStop);
      guest.removeEventListener("did-navigate", acceptNavigation);
      guest.removeEventListener("did-navigate-in-page", acceptInPageNavigation);
      guest.removeEventListener("page-title-updated", handleTitle);
      guest.removeEventListener("did-fail-load", handleFail);
      guest.removeEventListener("render-process-gone", handleGone);
      onDetached(tab.id, guest);
    };
  }, [activeIdRef, loadFailed, onAttached, onDetached, onPatch, tab.id, urlFocusRef]);

  return (
    <div className={active ? "browser-view is-active" : "browser-view"}>
      <webview ref={guestRef} src={tab.initialUrl} partition="persist:vx-browser" allowpopups="" />
      {tab.error && (
        <div className="browser-error">
          <span>{loadFailed}</span>
          {tab.error !== loadFailed && <small>{tab.error}</small>}
        </div>
      )}
    </div>
  );
};

const BrowserPanel = ({ api, full, open, labels, onToggleFull, onClose }) => {
  const [state, dispatch] = useReducer(browserReducer, undefined, initialBrowserState);
  const sequence = useRef(1);
  const activeIdRef = useRef(state.activeId);
  const openRef = useRef(open);
  const urlFocusRef = useRef(false);
  const urlInputRef = useRef(null);
  const guestRefs = useRef(new Map());
  const attachedGuests = useRef(new Set());
  const queuedLoads = useRef(new Map());
  const activeTab = state.tabs.find((tab) => tab.id === state.activeId) || state.tabs[0];

  useEffect(() => {
    activeIdRef.current = state.activeId;
  }, [state.activeId]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [state.activeId]);

  const patchTab = useCallback((id, patch) => {
    dispatch({ type: "patch", id, patch });
  }, []);

  const attachGuest = useCallback((id, guest) => {
    guestRefs.current.set(id, guest);
    attachedGuests.current.add(id);
    const queuedUrl = queuedLoads.current.get(id);
    if (queuedUrl) {
      queuedLoads.current.delete(id);
      guest.loadURL(queuedUrl).catch(() => {});
    }
  }, []);

  const detachGuest = useCallback((id, guest) => {
    if (guestRefs.current.get(id) === guest) {
      guestRefs.current.delete(id);
    }
    attachedGuests.current.delete(id);
    queuedLoads.current.delete(id);
  }, []);

  const addTab = useCallback((url = "about:blank") => {
    sequence.current += 1;
    dispatch({ type: "add", id: sequence.current, url });
  }, []);

  useEffect(() => api.onBrowserPopup((value) => {
    if (!openRef.current) {
      return;
    }
    const url = normalizeBrowserUrl(value);
    if (url && url !== "about:blank") {
      addTab(url);
    }
  }), [addTab, api]);

  const runGuestAction = (id, action) => {
    const guest = guestRefs.current.get(id);
    if (!guest || !attachedGuests.current.has(id)) {
      return false;
    }
    try {
      action(guest);
      return true;
    } catch {
      return false;
    }
  };

  const loadTab = (id, value) => {
    const url = normalizeBrowserUrl(value);
    if (!url) {
      return false;
    }
    if (!runGuestAction(id, (guest) => guest.loadURL(url).catch(() => {}))) {
      queuedLoads.current.set(id, url);
    }
    patchTab(id, { pendingUrl: null, error: "" });
    return true;
  };

  const closeTab = (id) => {
    if (state.tabs.length <= 1) {
      onClose();
      return;
    }
    dispatch({ type: "close", id });
  };

  const submitUrl = (event) => {
    event.preventDefault();
    if (activeTab) {
      loadTab(activeTab.id, activeTab.pendingUrl ?? activeTab.url);
    }
  };

  const handleUrlKeyDown = (event) => {
    if (event.key === "Escape" && activeTab) {
      patchTab(activeTab.id, { pendingUrl: null });
      event.currentTarget.blur();
    }
  };

  return (
    <aside className="browser-panel">
      <div className="browser-head">
        <div className="browser-tabs">
          {state.tabs.map((tab, index) => (
            <div key={tab.id} className={tab.id === state.activeId ? "browser-tab is-active" : "browser-tab"} onMouseDown={() => dispatch({ type: "select", id: tab.id })}>
              <span className="browser-tab-label">{state.tabs.length > 1 ? labels.tabN(index + 1) : labels.newTab}</span>
              {state.tabs.length > 1 && (
                <button className="browser-tab-close" title={labels.closeTab} onMouseDown={(event) => { event.stopPropagation(); closeTab(tab.id); }}><X size={12} /></button>
              )}
            </div>
          ))}
          <button className="browser-add" title={labels.addTab} onClick={() => addTab()}><Plus size={14} /></button>
        </div>
        <div className="browser-actions">
          <button className="browser-action" title={full ? labels.exitFullscreen : labels.fullscreen} onClick={onToggleFull}>
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button className="browser-action browser-action-close" title={labels.close} onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <form className="browser-toolbar" onSubmit={submitUrl}>
        <button type="button" className="browser-nav" disabled={!activeTab?.canBack} title={labels.back} onClick={() => runGuestAction(state.activeId, (guest) => guest.goBack())}><ChevronLeft size={16} /></button>
        <button type="button" className="browser-nav" disabled={!activeTab?.canForward} title={labels.forward} onClick={() => runGuestAction(state.activeId, (guest) => guest.goForward())}><ChevronRight size={16} /></button>
        <input
          ref={urlInputRef}
          className="browser-url"
          value={activeTab ? activeTab.pendingUrl ?? displayBrowserUrl(activeTab.url) : ""}
          placeholder={labels.urlPlaceholder}
          spellCheck="false"
          onFocus={() => { urlFocusRef.current = true; }}
          onBlur={() => { urlFocusRef.current = false; }}
          onChange={(event) => activeTab && patchTab(activeTab.id, { pendingUrl: event.target.value })}
          onKeyDown={handleUrlKeyDown}
        />
        <button type="button" className={activeTab?.loading ? "browser-nav browser-reload is-loading" : "browser-nav browser-reload"} title={labels.reload} onClick={() => runGuestAction(state.activeId, (guest) => guest.reload())}><RotateCw size={15} /></button>
      </form>
      <div className="browser-views">
        {state.tabs.map((tab) => (
          <BrowserView
            key={tab.id}
            tab={tab}
            active={tab.id === state.activeId}
            activeIdRef={activeIdRef}
            urlFocusRef={urlFocusRef}
            onPatch={patchTab}
            onAttached={attachGuest}
            onDetached={detachGuest}
            loadFailed={labels.loadFailed}
          />
        ))}
      </div>
    </aside>
  );
};

export default BrowserPanel;
