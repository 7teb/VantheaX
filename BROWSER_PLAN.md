# In-App-Browser, Implementierungsplan (v5)

> **STATUS: IMPLEMENTIERT UND AN DER GEPACKTEN EXE VERIFIZIERT.** Ursprünglich gegen den Baum vom 2026-07-27 geschrieben. Historische Zeilennummern bleiben als Entscheidungsnachweis erhalten.
>
> **v2 nach Review 1:** `allowpopups` ist doch nötig, sonst feuert der Popup-Handler nie (§8); `src` wird genau einmal gebunden, sonst lädt jeder Klick doppelt (§5.3); `pendingUrl` wird nicht mehr von jeder Navigation gelöscht (§5.2); Permission-Deny bekommt eine Allowlist (§8); `did-navigate-in-page` frischt die Pfeile mit auf (§9); Schema-Wand am Guest (§8); deutsche Strings mit Umlauten (§11).
>
> **v3 nach Review 2:** `closeDockExcept` ersetzt NICHT die Rümpfe der bestehenden Toggles und muss den eigenen Close-Timer des behaltenen Panels mit löschen, sonst wipet ein stale Timer die frisch geöffneten Tabs (§5.4); der `openFile`-Hook ist raus, er hätte bei jedem Datei-Klick laufende Terminal-Sessions getötet (§5.4); die URL-Regel-Reihenfolge machte `localhost:5173` zu `null` (§7); Popup-Tabs und schnelles Enter verloren ihre Navigation im Attach-Fenster (§5.7/§6.3); Partition, Deny-Handler und Download-Block wandern von Phase 3 nach Phase 2, weil der User die Phase-2-Exe testet (§13); `guestRefs` wird im Unmount geräumt (§5.5); die Fokus-Bedingung gilt pro Tab (§5.2); das `<webview>`-Element braucht eine eigene Größen-Regel (§4).
>
> **v4 nach Review 3:** `will-attach-webview` validiert jedes Guest vor dem Attach und erzwingt sichere WebPreferences (§8); Permission-Request und Permission-Check verwenden dieselbe Allowlist (§8); Hintergrund-Navigationen räumen veraltete URL-Entwürfe auf (§5.2/§9); Loopback-Adressen verwenden ohne explizites Schema `http://` (§7); sämtliche Guest-Härtung liegt vor dem ersten Laden fremder Inhalte in Phase 2 (§13); die gepackte App wird vom Agenten selbst live geprüft (§14); neue Code-Kommentare sind ausnahmslos verboten (§16).
>
> **v5 nach Review 4:** `will-redirect` und ein Main-Frame-Filter der Browser-Session schließen die bisher fehlenden Redirect- und direkten `loadURL`-Grenzen; v1 verweigert über Request- und Check-Handler ausnahmslos alle Web-Permissions; Guest-Listener lesen den aktiven Tab aus einer synchron gehaltenen Ref statt aus einer stale Closure; Tabs und aktive ID liegen in einem Reducer; Browser-UI, URL-Normalisierung und Main-Prozess-Härtung wandern in getrennte Module; URL-Tests importieren das echte Modul; ein lokaler HTTP-Fixture-Server deckt Navigation, Redirects, Popups, Downloads und Permissions deterministisch ab; privates LAN wird ohne explizites `http://` weiterhin nicht herabgestuft; Popup-Requests mit POST-Body werden in v1 blockiert statt still zu GET umgeschrieben.

---

## 1. Ziel und wörtliche Anforderung

Der User:

> "ich will basically das man oben rechts ein browser SVG drückt, dann kommt der browser rechts wie das CMD terminal so raus ge'fahren' und du renderst einfach nen normalen browser in der halb rechten ecker, oben rechts sollte ein refresh SVG sein, in der mitte URL des browsers, links daneben ein pfeil (links & rechts) für zurück und nach vorne quasi, ganz oben links über den 2 pfeilen soll 'new tab' stehen, und rechts daneben ein + du kannst mehrere tabs von browsern öffnen und wenn du einen öffnest geht der 1. tab auf tab 1 und der 2. auf tab 2 und oben rechts neben den X um das browser formular zu zu machen noch ein fullscreen SVG bitte, erstmal soll nur der browser gehen, danach können wir den agenten einschalten"

Daraus die Layout-Anforderung, aufgelöst in zwei Zeilen über der Seite:

- **Kopfzeile** (identisch zum Terminal-Kopf): links die Tab-Leiste plus `+`, rechts Fullscreen-Icon und `X`.
- **Toolbar-Zeile** darunter: Zurück-Pfeil, Vorwärts-Pfeil, URL-Feld (nimmt die Mitte ein), Refresh-Icon rechts.
- Tab-Beschriftung: bei genau einem Tab "New tab", ab zwei Tabs "Tab 1", "Tab 2", …

## 2. Scope

**v1 baut ausschließlich den Browser als Werkzeug für den Menschen.** Ausdrücklich NICHT in v1:

- Kein Tool für das Modell, keine `toolSpecs`-Erweiterung, kein IPC das der Agent-Loop erreichen kann. Der Agent weiß in v1 nicht, dass es den Browser gibt.
- Kein Console-/Network-Capture zurück in den Agent-Loop (der eigentliche Wert laut IDEAS.md #2, kommt danach).
- Keine Device-Emulation, kein Phone-Frame, kein Click-to-Source.
- Keine Persistenz der Tabs über einen App-Neustart.
- Keine Lesezeichen, keine History-UI, kein Download-Manager, kein DevTools-Zugriff auf die Seite.
- Kein Stopp-Button während des Ladens, kein eigener Zoom-Regler.

## 3. Substrat: `<webview>`, nicht `WebContentsView`

**Entscheidung: `<webview>`-Tag, mit `webviewTag: true` in den `webPreferences` des Hauptfensters.**

Das korrigiert die mündliche Empfehlung aus dem Gespräch davor (dort hatte ich `WebContentsView` genannt). Grund für den Wechsel, konkret an dieser App:

- **Eine `WebContentsView` liegt als Pixel-Overlay über dem Renderer.** Sie ist kein DOM-Knoten, clippt nicht per CSS, z-ordert nicht mit dem Renderer und scrollt nicht mit. Ihre Bounds müssen vom Main-Prozess gesetzt werden.
- Der User will, dass das Panel **rausfährt** wie das Terminal. Das ist eine 240ms-CSS-Transition auf `grid-template-columns` (`styles.css:349`). Eine `WebContentsView` kann daran nicht teilnehmen, ohne dass pro Frame neue Bounds über IPC gehen. Sonst poppt sie nach der Animation rein.
- Die App hat mehrere Vollflächen-Overlays, die über die rechte Spalte laufen: Settings-Seite, `SearchOverlay`, `Lightbox`. Jedes müsste die View aktiv verstecken und danach neu bounden.
- Dazu Bounds-Resync bei: Resizer-Drag, Fenster-Resize, Sidebar-Collapse, Fullscreen-Toggle und `window:zoom`.

`<webview>` löst alle sechs Punkte durch seine DOM-Natur zu null Kosten. Der Preis, ehrlich benannt: Electron rät von `<webview>` ab ("not guaranteed to remain available in future versions"), seit vielen Versionen so markiert und weiterhin vorhanden. Für eine private App, die auf Electron 39 gepinnt ist, ein akzeptierter und jederzeit umkehrbarer Trade-off.

**`webviewTag: true` vergrößert die Sicherheitsfläche.** Die Flag erlaubt es Renderer-Inhalten, `<webview>`-Elemente zu erzeugen. Der Renderer dieser App lädt ausschließlich das eigene Vite-Bundle von `file://`, aber ein späterer Renderer-Bug oder eine XSS dürfte deshalb trotzdem kein Guest mit fremdem `preload`, Node-Integration, falscher Partition oder unsicherer Start-URL erzeugen. Vor jedem Attach validiert deshalb `will-attach-webview` die Parameter, entfernt `preload` und erzwingt `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`, `experimentalFeatures: false` und `webviewTag: false`. Das Guest bleibt damit sandboxed, obwohl das bestehende Hauptfenster in `electron/main.js:4890` derzeit `sandbox: false` verwendet.

### 3.1 Phase 0, gemessenes Ergebnis

Bevor irgendeine UI entsteht, werden an der gepackten Exe sieben Fragen beantwortet. Der Grund steht in DECISIONS.md 2026-07-21: eine ungeprüfte Plattform-Annahme im heißen Pfad ist ein latenter Ausfall, und der `openrouter:datetime`-Vorfall hat genau diese Lektion gekostet.

Die gepackte Electron-39-App wurde gegen `scripts/browser-fixture.mjs` geprüft:

1. `<webview>` rendert sichtbar und nimmt die komplette Panel-Fläche ein.
2. Die Element-APIs heißen in diesem Build direkt `canGoBack()`, `goBack()`, `canGoForward()`, `goForward()`, `loadURL()` und `reload()`.
3. Attach, Navigation, In-Page-Navigation, Titel, Ladezustand, Fehler und Redirect-Grenze feuern wie benötigt.
4. Mit `allowpopups` erreichen GET-Links und `window.open` den Deny-Handler und werden interne Tabs. Ohne die Flag entsteht kein Tab. POST-Popups bleiben blockiert.
5. Das kurze Vor-Attach-Fenster wird durch `queuedLoads` abgefangen. Direktes Enter nach einem neuen Tab lädt zuverlässig.
6. Geolocation wurde im Guest abgelehnt. Beide Session-Handler verweigern generell alle Permissions.
7. Falsche Partition und `file:`-Start-URL attachen nicht. Ein künstliches `preload` wird entfernt. Der Guest-Prozess läuft mit `--enable-sandbox`, `process` und `require` sind `undefined`.

## 4. Layout-Integration (verifizierte Anker)

Die dritte Grid-Spalte teilen sich heute Inspector, Terminal und Background-Tasks. Der Browser ist der vierte Konsument derselben Spalte.

Bestehende Regeln in `src/styles.css`:

```
.app-shell                          :342   grid-template-columns: 300px minmax(360px,1fr) 370px, transition .24s
.terminal-open .app-shell           :364   300px minmax(0,1fr) var(--term-width, 42%)
.terminal-open.sidebar-collapsed    :368
.background-open .app-shell         :372   identisch
.background-open.sidebar-collapsed  :376
.terminal-full .app-shell           :380   300px 0 minmax(0,1fr)
.terminal-full.sidebar-collapsed    :384
.background-full .app-shell         :388 / :392
.terminal-full .chat-panel          :396   overflow hidden + pointer-events none
.terminal-open/.background-open .app-shell :402  position relative (fuer den Resizer)
.terminal-resizer                   :407   right: calc(var(--term-width,42%) - 4px)
.inspector-closed .app-shell        :356   300px minmax(360px,1fr) 0px
```

**Neu:** `browser-open`, `browser-open.sidebar-collapsed`, `browser-full`, `browser-full.sidebar-collapsed` als exakte Kopien der jeweiligen `background-*`-Regel, plus `.browser-full .chat-panel` in die Selektorgruppe bei `:396` und `.browser-open .app-shell` in die Gruppe bei `:402`. Eingefügt **nach `:394`**, damit die Kaskade gegen `.inspector-closed .app-shell` (`:356`) bei gleicher Spezifität über die Reihenfolge gewinnt, genau wie die Terminal-Regeln es heute tun.

Die Breite teilt sich `--term-width` mit Terminal und Background, damit die vom User gezogene Breite über alle drei Panels gleich bleibt. Der Default `42%` entspricht der geforderten "halb rechten Ecke".

Top-Right-Cluster in `.chat-panel`, absolut positioniert, Abstand 38px:

```
.panel-switch-button   :1675   right: 18px
.root-open-button      :1109   right: 56px
.terminal-toggle       :1132   right: 94px
```

**Neu:** `.browser-toggle` bei `right: 132px`, ansonsten Regel-für-Regel-Kopie von `.terminal-toggle` (`:1132-1158`) inklusive `:hover` und `.is-on`.

Panel-Aufbau als Kopie von `.terminal-panel` (`:1160`), `.terminal-head` (`:1511`), `.terminal-tab` (`:1536`), `.terminal-views` (`:1645`), `.terminal-view` (`:1651`).

Zwei Regeln, die die Terminal-Kopie NICHT mitbringt und die trotzdem gebraucht werden:

- **`.browser-view webview { width: 100%; height: 100% }`.** Ein `<webview>` ist per Default `display: inline-block` ohne Höhe und kollabiert in einem `position: absolute; inset: 0`-Container auf null. Ohne diese Regel rendert das Guest unsichtbar. Beim Terminal stellt sich das nicht, dort füllt `.terminal-view .xterm { height: 100% }` (`:1662`) die Fläche.
- **Kein vertikales Padding auf dem geclippten Inner**, falls je ein Collapse dazukommt: FIXES #5, hier nur zur Sicherheit notiert, der Browser-Panel klappt nichts.

**Wichtig am Tab-Stacking:** `.terminal-view` versteckt inaktive Tabs über `visibility: hidden` bei `position: absolute; inset: 0` (`:1651-1660`), nicht über `display: none`. Das wird eins zu eins übernommen und ist keine Stilfrage: `display: none` nimmt das Guest aus dem Layout und kann es je nach Electron-Version anhalten oder neu laden. `visibility: hidden` lässt es laufen und behält die Größe.

## 5. State und Komponenten (`src/main.jsx`)

Spiegelt den Terminal-Block bei `:2050-2062`.

```
const [browserOpen, setBrowserOpen] = useState(false);
const [browserFull, setBrowserFull] = useState(false);
const [browserClosing, setBrowserClosing] = useState(false);
const browserCloseTimer = useRef(null);
```

`BrowserPanel` kapselt den tabbezogenen Zustand in `useReducer` als ein zusammenhängendes `{ tabs, activeId }`. Damit kann kein Render einen gelöschten aktiven Tab mit einer bereits aktualisierten Tab-Liste kombinieren. `activeIdRef` wird synchron per Effekt aktualisiert und von allen langlebigen Guest-Listenern gelesen. `guestRefs`, `urlFocusRef` und die Tab-Sequenz bleiben ebenfalls innerhalb des Browser-Moduls. Der App-Root besitzt nur Öffnen, Vollbild und Closing-Timer.

### 5.1 Tab-Objekt

```
{ id, initialUrl, url, pendingUrl, title, loading, canBack, canForward, error }
```

- `initialUrl` wird bei der Erzeugung gesetzt und **danach nie geändert**, siehe §5.3.
- `url` ist die zuletzt vom Guest gemeldete echte Adresse.
- `pendingUrl` ist der Text im URL-Feld, solange der User tippt, sonst `null`.

### 5.2 Die `pendingUrl`-Regel, vollständig

Genau vier Ereignisse setzen `pendingUrl` auf `null`:

1. Erfolgreiches Absenden mit Enter (§5.7 präzisiert "erfolgreich").
2. Escape im Feld.
3. Ein `did-navigate`, **wenn der meldende Tab nicht aktiv ist ODER `urlFocusRef.current === false`**.
4. Ein `did-navigate-in-page` des Main Frames unter derselben Bedingung.

Die einzige Situation, in der ein Entwurf erhalten bleibt, ist `meldenderTab === activeIdRef.current && urlFocusRef.current === true`. Dann tippt der User gerade sichtbar in genau diesem Feld. Jede Navigation eines Hintergrund-Tabs räumt dessen Entwurf auf, weil der User dort unmöglich gerade tippen kann. Jede Navigation des aktiven Tabs räumt ihn ebenfalls auf, sobald das Feld nicht fokussiert ist.

Die konkrete Löschbedingung lautet deshalb:

```
tabId !== activeIdRef.current || !urlFocusRef.current
```

Sie gilt identisch für `did-navigate` und `did-navigate-in-page`. Damit kann weder eine Redirect-Kette im Hintergrund noch eine `pushState`-Navigation einen veralteten Entwurf hinterlassen.

### 5.3 `src` wird genau einmal gebunden

`BrowserView` bekommt `initialUrl`, **nicht** `url`. Das `<webview>` rendert `src={initialUrl}`, und weil `initialUrl` nach der Tab-Erzeugung konstant ist, schreibt React das Attribut nie erneut.

Das ist keine Mikro-Optimierung: eine Zuweisung an `src` löst laut Electron-Doku eine Navigation aus, auch wenn der Wert identisch zur aktuellen Adresse ist. Käme `url` als Prop rein, würde jeder Klick im Guest ein `did-navigate` auslösen, das den State ändert, das React `src` neu schreiben lässt, das dieselbe Seite noch einmal lädt und einen zweiten History-Eintrag erzeugt. **Jede Navigation nach dem Mount läuft ausschließlich über `guestNav.load`** (§6.3), nie über das Attribut.

Damit React das Element nicht doch neu erzeugt, hat jeder `BrowserView` ein stabiles `key={tab.id}` und liest nur `active` als sich ändernde Prop.

### 5.4 Panel-Ausschluss über EINEN Helfer

**`closeDockExcept(keep)` regelt ausschließlich den gegenseitigen Ausschluss. Es ersetzt keinen Toggle-Rumpf.** Öffnen, Toggle-zu-Branch, Tab-Seeding und das Schließen des Panel-Menüs bleiben in den Aufrufern.

```
const closeDockExcept = (keep) => {
  if (termCloseTimer.current) { clearTimeout(termCloseTimer.current); termCloseTimer.current = null; }
  setTermClosing(false);
  if (keep !== "terminal") { setTerminalOpen(false); setTerminalFull(false); setTermTabs([]); }

  if (backgroundCloseTimer.current) { clearTimeout(backgroundCloseTimer.current); backgroundCloseTimer.current = null; }
  setBackgroundClosing(false);
  if (keep !== "background") { setBackgroundOpen(false); setBackgroundFull(false); }

  if (browserCloseTimer.current) { clearTimeout(browserCloseTimer.current); browserCloseTimer.current = null; }
  setBrowserClosing(false);
  if (keep !== "browser") { setBrowserOpen(false); setBrowserFull(false); setBrowserTabs([]); }

  setInspectorOpen(false);
};
```

**Der Timer und das Closing-Flag werden für ALLE drei gelöscht, auch für das behaltene Panel.** Das ist nicht Symmetrie um ihrer selbst willen, sondern ein echter Ausfall: der heutige Code macht es beim Öffnen ebenfalls für sich selbst (`toggleTerminal` löscht `termCloseTimer` und setzt `setTermClosing(false)`, `:2916-2920`; `openRightPanel` dasselbe für Background, `:2860-2865`). Ohne das gilt: Terminal per X schließen (Timer läuft, feuert bei 260ms `setTermTabs([])`, `:2891-2895`), innerhalb der 260ms wieder öffnen, der stale Timer feuert danach und leert `termTabs` bei offenem Panel. Ergebnis wäre ein offenes Terminal ohne Tabs, und weil der `TerminalView`-Unmount `api.terminalClose` ruft (`:4693-4695`), ist die PTY dabei tot. Für den Browser identisch.

**Der Sofort-Reset der anderen Panels ist Absicht, kein animiertes Schließen.** Der bestehende Code macht das cross-panel schon genau so (`:2852-2859`, `:2916-2927`) und ruft nie `closeTerminal()`/`closeBackground()` quer, denn die starten einen 260ms-Nachlauf. Täte der Browser das, wären für 260ms zwei `<aside>` in einem Grid montiert, das nur drei Spalten definiert (`:342-344`); das zweite landet in einer impliziten vierten Spalte, wird von `overflow: hidden` abgeschnitten und springt beim Ablaufen des Timers rein. Der animierte Nachlauf gilt weiterhin **nur** beim Schließen per eigenem `X` oder erneutem Klick auf den eigenen Toggle.

**Die Aufrufer, exakt:**

```
const toggleTerminal = () => {
  if (terminalOpen) { closeTerminal(); return; }
  closeDockExcept("terminal");
  if (!termTabs.length) { addTermTab(); }
  setTerminalOpen(true);
};

if (view === "background") {
  setRightPanel("");
  closeDockExcept("background");
  setBackgroundOpen(true);
  return;
}

const toggleBrowser = () => {
  if (browserOpen) { closeBrowser(); return; }
  closeDockExcept("browser");
  if (!browserTabs.length) { addBrowserTab(); }
  setBrowserOpen(true);
};
```

Das `setRightPanel("")` im Background-Zweig muss bleiben: es ist die einzige Stelle, die das PanelSwitch-Dropdown schließt, nachdem darin "Background Tasks" gewählt wurde (`onPick`, `:4573`; Menü offen solange `rightPanel === "menu"`, `:3615`). Der Outside-Click-Handler greift dort nicht, weil der Klick innerhalb `.panel-switch` liegt (`:2269`).

**`openFile` wird NICHT angefasst.** Ein früherer Entwurf ließ `openFile` (`:3017`) den Dock leerräumen. Das wäre eine Regression an einem laufenden Feature: heute fasst `openFile` weder Terminal noch Background an, der Inspector wird bei offenem Terminal schlicht nicht gerendert (`inspectorOpen && !terminalOpen`, `:3724`) und erscheint erst danach. Mit dem Hook hätte ein Klick auf eine Datei im Sidebar-Baum synchron `termTabs` geleert und damit jede laufende Shell-Session gekillt. Die Ausschluss-Richtung existiert im Ist-Zustand bewusst nur andersherum, und das bleibt so.

**Die restlichen Stellen, die den Browser kennen müssen:**

1. Inspector-Render-Bedingung `{inspectorOpen && !terminalOpen && (…)}` (`:3724`) wird zu `{inspectorOpen && !terminalOpen && !browserOpen && (…)}`. Das ist die Entsprechung zum bestehenden Terminal-Term, nicht der neue Hook von oben.
2. Resizer-Bedingung (`:3735`) bekommt `|| (browserOpen && !browserFull)`.
3. Resize-Effekt (`:2971-2983`): `browserOpen` in Bedingung und Dependency-Array.
4. `window-root`-Klassenliste (`:3489`): `browser-open` und `browser-full`.

`clampTermWidth` (`:2947`) und `startTermResize` (`:2953`) bleiben unverändert, sie arbeiten schon rein auf `--term-width` und der Shell-Breite.

**Bewusst NICHT geändert:** `openRightPanel` für `"context"` und `"tasks"` schließt heute den Background (`:2869-2871`), aber nicht das Terminal. Der Browser wird dort genauso wenig geschlossen wie das Terminal, denn Kontext- und Tasks-Panel sind Overlays über der Chat-Spalte und konkurrieren nicht um die Dock-Spalte.

**Und was hier bewusst NICHT passiert:** DECISIONS.md 2026-07-21 hält fest, dass zwei Booleans, die sich gegenseitig ausschalten müssen, die Bug-Form sind, und nennt den In-App-Browser dort namentlich als Grund für den `rightPanel`-String-Umbau. Der strukturell saubere Zug wäre, Inspector, Terminal, Background und Browser ebenfalls auf einen `dock`-String zu ziehen. Das ist **nicht** Teil dieses Plans, weil die Hausregel aus HANDOFF.md ("keine unbestellten Änderungen neben eine bestellte packen") schwerer wiegt: das wäre ein Refactor von zwei laufenden Features neben einem neuen. `closeDockExcept` holt den praktischen Nutzen (eine Wahrheit für den Ausschluss) ohne den State-Umbau. Der volle Umbau gehört als eigener Punkt in TODO.md.

### 5.5 Handler, und die Falle, die nicht kopiert wird

`addBrowserTab(url)`, `closeBrowser`, `toggleBrowser` folgen `addTermTab` (`:2875`), `closeTerminal` (`:2883`) und `toggleTerminal` (`:2911`), inklusive der 260ms-Nachlauf-Mechanik über `browserClosing`.

`addBrowserTab` nimmt eine **optionale Start-URL**. Ohne Argument ist `initialUrl = "about:blank"`, mit Argument die übergebene Adresse. Das ist der Weg, auf dem der Popup-Pfad (§8) seinen Tab bekommt, ohne den Adapter zu brauchen, siehe §5.7.

**`closeBrowserTab` wird NICHT nach dem Vorbild von `closeTermTab` (`:2935-2945`) gebaut.** Das dortige Muster ruft `setTermActive` INNERHALB des `setTermTabs`-Updaters auf (`:2940-2944`). Ein State-Updater muss rein sein; unter StrictMode oder einem von React wiederholten Render läuft der Seiteneffekt doppelt. Stattdessen:

```
const closeBrowserTab = (id) => {
  if (browserTabs.length <= 1) { closeBrowser(); return; }
  const next = browserTabs.filter((tab) => tab.id !== id);
  setBrowserTabs(next);
  if (browserActive === id) { setBrowserActive(next[next.length - 1].id); }
};
```

Beide Setter stehen außerhalb jedes Updaters, und der Frühausstieg garantiert, dass `next` nie leer ist.

**`guestRefs` wird im Unmount von `BrowserView` geräumt, nicht hier.** Der Cleanup des Mount-Effekts löscht den eigenen Eintrag. Nur so deckt es alle Pfade ab: `closeBrowserTab` returnt beim letzten Tab früh, und `closeBrowser` beziehungsweise `closeDockExcept` leeren `browserTabs`, ohne die Map anzufassen. Ohne die Unmount-Räumung hält die Map detachte Elemente samt totem Guest.

### 5.6 Escape und Shortcuts

Der globale Escape-Handler (`:2238-2256`) wird **nicht** angefasst. Das Terminal wird von Escape auch nicht geschlossen, und ein Escape gehört beim Browsen in die Seite. Einzige Ausnahme ist das URL-Feld, das Escape lokal abfängt (§6.2) und per `stopPropagation` nicht durchreicht.

Bekannte, akzeptierte Folge: solange der Fokus im Guest liegt, feuern die globalen `keydown`-Handler der App nicht (Ctrl+B `:2652`, Ctrl+J `:2655`), weil die Tastatur an ein anderes WebContents geht. Sie wirken erst wieder nach einem Klick zurück in die App. Electron-Verhalten, kein Bug, wird nicht umgangen.

### 5.7 Das Attach-Fenster, und wie beide Wege es überleben

Element-Methoden eines `<webview>` werfen, bevor das Guest attached ist. Der Adapter fängt das ab (§6.3), aber "nicht werfen" allein reicht nicht: eine verschluckte Navigation ist ein leerer Tab. Zwei Wege führen in dieses Fenster, beide werden gelöst, ohne sich auf Timing zu verlassen:

- **Popup wird zum Tab.** Der Renderer ruft `addBrowserTab(url)`; die Adresse landet als `initialUrl` im `src`-Attribut und wird von der Einmal-Bindung aus §5.3 geladen. Es wird **nie** `guestNav.load` auf einem frisch gemounteten Guest gerufen. Ohne das würde jeder `target="_blank"`-Klick einen leeren Tab öffnen.
- **Enter direkt nach dem Öffnen eines Tabs.** `guestNav.load` gibt `true` zurück, wenn die Navigation wirklich abgesetzt wurde, sonst `false`. Der Enter-Handler löscht `pendingUrl` **nur bei `true`**. Schlägt es fehl, bleibt der getippte Text stehen und ein zweites Enter funktioniert. Ohne das verschwindet die Eingabe und nichts lädt.

Phase 0 Frage 5 misst, wie groß das Fenster überhaupt ist. Der Plan verlässt sich aber nicht auf die Antwort, beide Wege sind unabhängig davon korrekt.

## 6. Die zwei Kopfzeilen im Detail

### 6.1 Kopfzeile (Tabs)

Struktur eins zu eins wie `TerminalPanel` (`:4721-4748`):

```
<div className="browser-head">
  <div className="browser-tabs">
    Tab-Chips …            Label: tabs.length > 1 ? t("browser.tabN",{n:index+1}) : t("browser.newTab")
                           X pro Tab nur wenn tabs.length > 1
    <button className="browser-add">  <Plus size={14} />
  </div>
  <div className="terminal-actions">
    <button>  Fullscreen   {full ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
    <button>  Schliessen   <X size={16}/>
  </div>
</div>
```

`.terminal-actions` (`:1613`) ist eine ungescope-te Button-Gruppe ohne Terminal-Bezug und wird wiederverwendet statt kopiert.

### 6.2 Toolbar

```
<div className="browser-toolbar">
  <button className="browser-nav" disabled={!tab.canBack}>     <ChevronLeft size={16}/>
  <button className="browser-nav" disabled={!tab.canForward}>  <ChevronRight size={16}/>
  <input className="browser-url" … />
  <button className="browser-nav">                             <RotateCwIcon size={15}/>
</div>
```

Das URL-Feld ist `flex: 1` und nimmt die Mitte ein. Reihenfolge und Position folgen der Anforderung wörtlich: zwei Pfeile links, URL in der Mitte, Refresh rechts, Tab-Zeile mit "New tab" darüber.

Verhalten des Feldes:

- **Anzeigewert:** `tab.pendingUrl ?? displayUrl(tab.url)`, wobei `displayUrl` genau eine Sonderregel hat: `about:blank` wird zu `""`. Sonst steht in jedem frischen Tab wörtlich "about:blank" statt des Platzhalters, weil das Guest auch für die Startseite ein `did-navigate` feuert.
- `onChange` setzt `pendingUrl`.
- `onFocus` setzt `urlFocusRef.current = true` und ruft `select()`.
- `onBlur` setzt `urlFocusRef.current = false`, verwirft `pendingUrl` aber NICHT; sonst verliert ein Klick ins Guest die halb getippte Adresse.
- Enter: `normalizeBrowserUrl` (§7); bei `null` passiert nichts; sonst `guestNav.load` und `pendingUrl` nur bei Rückgabe `true` auf `null` (§5.7).
- Escape: `pendingUrl` auf `null`, `stopPropagation`.

Während `tab.loading` bekommt Refresh keine Stopp-Funktion, das ist nicht gefordert.

### 6.3 Guest-Adapter

Alle Guest-Aufrufe laufen über **eine** Stelle, kein Aufrufer greift direkt ans Element:

```
const guestNav = (el) => {
  const ok = Boolean(el && el.isConnected && el.dataset.attached === "1");
  const nav = el && el.navigationHistory;
  const run = (fn) => { if (!ok) { return false; } try { fn(); return true; } catch { return false; } };
  return {
    back:       () => run(() => (nav ? nav.goBack() : el.goBack())),
    forward:    () => run(() => (nav ? nav.goForward() : el.goForward())),
    reload:     () => run(() => el.reload()),
    load:       (url) => run(() => { const r = el.loadURL(url); if (r && r.catch) { r.catch(() => {}); } }),
    canBack:    () => { if (!ok) { return false; } try { return nav ? nav.canGoBack() : el.canGoBack(); } catch { return false; } },
    canForward: () => { if (!ok) { return false; } try { return nav ? nav.canGoForward() : el.canGoForward(); } catch { return false; } },
  };
};
```

Vier Dinge, die der Adapter abfängt und die sonst je einen Bug ergeben:

- **Feature-Detection** statt Festlegung auf einen API-Namen, weil §3.1 Frage 2 offen ist.
- **Attach-Guard.** `data-attached="1"` wird im `did-attach`-Handler gesetzt.
- **Rückgabewert `true`/`false`,** damit der Aufrufer weiß, ob die Navigation lief (§5.7).
- **`loadURL` gibt ein Promise zurück, das bei abgebrochener Navigation rejected.** Ohne den `.catch` produziert jedes schnelle Weiterklicken eine unhandled rejection.

## 7. URL-Behandlung

Eine reine Funktion `normalizeBrowserUrl(input)` auf Modulebene, closure-frei, damit sie isoliert slicebar ist (§14). **Die Reihenfolge der Regeln ist Teil der Spezifikation**, die Loopback- und Host-Port-Regeln müssen vor der allgemeinen Schema-Prüfung stehen:

1. Trimmen. Leer → `null` (nichts tun).
2. Beginnt mit `http://` oder `https://` → unverändert übernehmen.
3. Ist exakt `about:blank` → übernehmen.
4. **Loopback-Ziel ohne Schema**, also `localhost`, `localhost:<port>`, `127.0.0.1`, `127.0.0.1:<port>`, `[::1]` oder `[::1]:<port>`, jeweils optional mit Pfad → `http://` davor. Lokale Vite-, Preview- und Testserver sprechen standardmäßig HTTP; ein erzwungenes `https://` würde sie unbenutzbar machen.
5. **Anderer Host mit Port**, also `^[A-Za-z0-9.-]+:\d+(/.*)?$` → `https://` davor. Diese Regel steht bewusst VOR der Schema-Prüfung: ein generischer Schema-Matcher (`^[A-Za-z][A-Za-z0-9+.-]*:`) matcht sonst `example.com:8080` mit dem "Schema" `example.com`, weil der Punkt im Schema-Alphabet erlaubt ist.
6. Beginnt mit irgendeinem Schema (`^[A-Za-z][A-Za-z0-9+.-]*:`) → **`null`**, nicht navigieren. Deckt `file:`, `javascript:`, `data:`, `chrome:`, `devtools:`, `blob:`, `ws:` und alles Weitere ab. `javascript:` und `data:` in einer Adressleiste sind der klassische Selbstbeschuss, `file:` würde den Browser zum Datei-Explorer der ganzen Platte machen.
7. Sieht aus wie ein Host (kein Whitespace, enthält einen Punkt mit mindestens einem Zeichen davor und danach) → `https://` davor.
8. Sonst → DuckDuckGo-Suche `https://duckduckgo.com/?q=<encodeURIComponent(input)>`.

Regel 8 ist eine Entscheidung, kein Zwang: ohne sie fühlt sich die Adressleiste kaputt an, sobald jemand ein Wort eintippt. Fällt sie weg, wird Regel 7 zum Endpunkt, alles andere bleibt gleich.

Dieselbe Schema-Prüfung greift ein zweites Mal an der Guest-Grenze (§8), damit auch eine von der Seite selbst ausgelöste Navigation nicht aus `http`/`https` ausbricht.

## 8. Sicherheit

Das Guest lädt fremdes Web in den Prozessbaum der App.

- **`will-attach-webview` ist die erste Sicherheitsgrenze.** Der Handler hängt an `mainWindow.webContents`, bevor das Renderer-Bundle geladen wird. Er akzeptiert nur `partition === "persist:vx-browser"` und eine initiale URL mit `http:`, `https:` oder exakt `about:blank`. Er entfernt `webPreferences.preload` und erzwingt `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`, `experimentalFeatures: false` und `webviewTag: false`. Ungültige Partitionen oder Start-URLs brechen das Attach per `preventDefault` ab. Defaults allein reichen hier nicht, weil `webviewTag: true` jede spätere Renderer-Lücke zu einer Guest-Erzeugungsfläche machen würde.
- **Eigene Session:** `partition="persist:vx-browser"`. Eigener Cookie-Jar, getrennt von allem anderen, aber persistent, damit Logins einen Neustart überleben. **Das Attribut sitzt ab Phase 2 dran, nicht erst ab Phase 3**, siehe §13.
- **`allowpopups` ist eine kontrollierte Ausnahme und wird nie ohne fertigen Deny-Handler aktiviert.** Der globale `web-contents-created`-Handler wird vor `createWindow` registriert. Für jedes Guest setzt er sofort `setWindowOpenHandler`, gibt ausnahmslos `{ action: "deny" }` zurück und leitet nur eine mit `isBrowserGuestUrlAllowed` validierte HTTP-/HTTPS-URL ohne POST-Body als neuen internen Tab weiter. Popup-Requests mit POST-Body bleiben in v1 blockiert, weil eine Weitergabe als URL ihre Semantik und Nutzdaten verlieren und unbemerkt zu GET werden würde. Erst danach darf das Renderer-Element `allowpopups` tragen.
- **Schema-Wand am Guest:** `will-navigate`, `will-frame-navigate` und das separat abbrechbare `will-redirect` prüfen Main-Frame-Ziele mit dem URL-Parser. Zusätzlich blockiert `webRequest.onBeforeRequest` auf der eigenen Browser-Session jeden Main-Frame-Request außerhalb von HTTP und HTTPS. Damit kann auch ein direkter programmgesteuerter `loadURL`-Aufruf die Grenze nicht umgehen. `about:blank` bleibt als interner Startzustand erlaubt. Subframe-Navigationen werden nicht pauschal reduziert, weil normale Seiten intern `blob:`, `data:` und `about:srcdoc` verwenden können; dort bleibt Chromiums aktiviertes `webSecurity` zuständig.
- **Downloads sind in v1 aus.** `session.on("will-download")` auf der Partition ruft `item.cancel()`.
- **Permissions sind in v1 vollständig aus.** `session.setPermissionRequestHandler` ruft immer `callback(false)`, `session.setPermissionCheckHandler` liefert immer `false`. Damit hängen Sicherheit und Tests nicht an versionsabhängigen Permission-Namen. Das Panel-Vollbild ist reine App-UI und benötigt keine Webseiten-Permission. Die Handler hängen **an der Browser-Partition**, nicht an der Default-Session, und lassen das Verhalten der App selbst unberührt.
- **Das Hauptfenster bleibt unberührt.** `setWindowOpenHandler` und `will-navigate` an `mainWindow.webContents` (`:4894`, `:4898`) gelten weiter. Ein Guest ist ein eigenes WebContents, seine Navigation läuft nicht durch diese Handler.
- **Guest-Absturz beendet die App nicht.** `render-process-gone` setzt den Tab auf einen Fehlerzustand mit Reload-Hinweis.

## 9. Guest-Events → React-State

In `BrowserView` per `addEventListener` im Mount-Effekt, Cleanup beim Unmount (der auch `guestRefs` räumt, §5.5):

| Event | Wirkung auf den Tab |
|---|---|
| `did-attach` | `data-attached="1"` setzen (§6.3), Element in `guestRefs` eintragen |
| `did-start-loading` | `loading: true`, `error: ""` |
| `did-stop-loading` | `loading: false`, `canBack`/`canForward` neu abfragen |
| `did-navigate` | `url` setzen; `pendingUrl` löschen, wenn der Tab nicht aktiv ODER das URL-Feld nicht fokussiert ist (§5.2); `canBack`/`canForward` neu abfragen |
| `did-navigate-in-page` | nur wenn `event.isMainFrame`: `url` setzen; dieselbe `pendingUrl`-Regel wie bei `did-navigate`; `canBack`/`canForward` neu abfragen |
| `page-title-updated` | `title` setzen |
| `did-fail-load` | nur wenn `event.isMainFrame` UND `event.errorCode !== -3`: `error` setzen |
| `render-process-gone` | `error` setzen, `loading: false` |

Drei Details, die sonst je einen Fehlalarm oder eine tote Schaltfläche erzeugen:

- **`isMainFrame` filtern.** Jedes fehlschlagende Werbe-Iframe feuert `did-fail-load`; ohne Filter zeigt die UI dauernd Fehler auf Seiten, die einwandfrei laden.
- **`errorCode -3` ist `ERR_ABORTED`** und tritt bei jeder normal abgebrochenen Navigation auf, etwa wenn der User weiterklickt bevor die Seite fertig ist. Kein Fehler.
- **`did-navigate-in-page` muss die Pfeile mit auffrischen.** Seiten, die per `pushState` navigieren (YouTube, GitHub, Twitter), erzeugen History-Einträge ohne Ladevorgang. Ohne diese Zeile bleiben Zurück und Vorwärts genau auf den meistbesuchten Seiten falsch ausgegraut.

`canBack`/`canForward` werden über den Adapter aktiv abgefragt, nie aus dem Ereignisfluss geraten.

## 10. Lebenszyklus der Tabs

- Ein neuer Tab ohne Argument startet mit `initialUrl = "about:blank"`, der Fokus springt ins URL-Feld, und das Feld zeigt dank `displayUrl` (§6.2) den Platzhalter statt "about:blank". Ein Tab aus dem Popup-Pfad startet direkt mit seiner Ziel-URL (§5.7).
- **Das Schließen des Panels zerstört alle Tabs**, exakt wie beim Terminal (`closeTerminal` leert `termTabs` nach 260ms, `:2891`). Konsequenz, bewusst und dokumentiert: Panel zu und wieder auf heißt neuer leerer Tab, die Seiten sind weg. Die Alternative wäre, versteckte Guests weiterlaufen zu lassen; dann spielt eine Seite unsichtbar Audio weiter und lädt im Hintergrund. Für v1 gewinnt Zerstören. Falls der User das anders will, ist es eine Ein-Zeilen-Änderung an derselben Stelle.
- Kein `beforeunload`-Dialog, keine Wiederherstellung nach Neustart.

## 11. Neue Strings und Icons

**i18n, beide Blöcke** (`STRINGS.en` und `STRINGS.de`, Terminal-Nachbarschaft bei `:276-285` beziehungsweise `:660-669`). Der deutsche Block schreibt Umlaute und ß aus ("Tab schließen" `:665`, "Vollbild verlassen" `:667`), das wird hier genauso gemacht, sonst stehen zwei Schreibweisen desselben Wortes nebeneinander in derselben Oberfläche:

```
browser.open           "Browser"                   / "Browser"
browser.newTab         "New tab"                   / "Neuer Tab"
browser.tabN           "Tab {n}"                   / "Tab {n}"
browser.addTab         "New tab"                   / "Neuer Tab"
browser.closeTab       "Close tab"                 / "Tab schließen"
browser.close          "Close browser"             / "Browser schließen"
browser.fullscreen     "Fullscreen"                / "Vollbild"
browser.exitFullscreen "Exit fullscreen"           / "Vollbild verlassen"
browser.back           "Back"                      / "Zurück"
browser.forward        "Forward"                   / "Vorwärts"
browser.reload         "Reload"                    / "Neu laden"
browser.urlPlaceholder "Search or enter address"   / "Suchen oder Adresse eingeben"
browser.loadFailed     "Could not load this page"  / "Seite konnte nicht geladen werden"
```

**Icons.** Vorhanden und wiederverwendet: `Plus`, `X`, `Maximize2`, `Minimize2`, `ChevronLeft`, `ChevronRight` (alle bereits in `src/main.jsx:3` importiert). Neu als lokale SVG-Komponenten im bestehenden Icon-Block (Konvention: 24er-Viewbox, `currentColor`, `strokeWidth 2`, `strokeLinecap/Linejoin round`, keine Kommentare):

- `AppWindowIcon` für den Toggle oben rechts. Bewusst nicht `Globe`, das Icon gehört schon der Websuche und würde die zwei Funktionen optisch vermischen.
- `RotateCwIcon` für Refresh.

## 12. Berührungspunkte

**`electron/main.js`**

1. `webPreferences` (`:4886-4891`): `webviewTag: true` ergänzen. Einzige Änderung an der Fensterkonfiguration.
2. Das neue Modul `electron/browser-guest.js` kapselt URL-Validator, `will-attach-webview`, Partitionshärtung und die globalen Guest-Listener.
3. Direkt nach der Erzeugung des Hauptfensters und vor `loadURL`/`loadFile`: `will-attach-webview` registrieren, Parameter validieren, `preload` entfernen und die sicheren Guest-WebPreferences aus §8 erzwingen.
4. Nach `app.whenReady`: Partition `persist:vx-browser` holen, beide vollständigen Permission-Deny-Handler und `will-download` gemäß §8 setzen.
5. `app.on("web-contents-created")` vor `createWindow` registrieren. Für `contents.getType() === "webview"` sofort `setWindowOpenHandler` (immer deny, sichere GET-URL an den Renderer), `will-navigate`, `will-frame-navigate` und `will-redirect` setzen.
5. `isBrowserGuestUrlAllowed` ist der eine Main-Prozess-Validator für Attach, Navigation und Popup-URLs. Er verwendet `new URL`, akzeptiert nur HTTP, HTTPS und an den ausdrücklich genannten Stellen exakt `about:blank` und wirft bei ungültiger Eingabe nicht.
6. **Keine Änderung** an `toolSpecs`, `toolsForContext`, `executeTool`, `buildSystemPrompt`, `runAgentStream`, dem katastrophalen Floor oder irgendeinem Agent-Permission-Pfad. v1 gibt dem Modell nichts.

**`electron/preload.js`**

7. Ein `onBrowserPopup`-Listener im Muster der bestehenden `on*`-Bridges (Unsubscribe-Funktion zurückgeben).

**`src/main.jsx`**

8. `src/browser/BrowserPanel.jsx` kapselt Panel, Reducer, Tabs, Toolbar, Guest-Adapter und Guest-Events. `src/browser/browser-url.js` enthält die importierbaren URL-Funktionen.
9. Der State-Block im App-Root enthält nur Panel-Öffnung, Vollbild, Closing und Timer.
10. `closeDockExcept` plus die Browser-Handler nach `:2945`; `toggleTerminal` (`:2911`) und der Background-Zweig von `openRightPanel` (`:2849`) rufen den Helfer, behalten aber ihre Öffnen-Logik (§5.4).
11. Die vier restlichen Anpassungsstellen aus §5.4.
12. `normalizeBrowserUrl` und `displayBrowserUrl` werden aus `src/browser/browser-url.js` importiert.
13. `BrowserPanel` wird aus dem Browser-Modul importiert und neben `TerminalPanel` gerendert.
14. Render-Block neben dem Terminal-Panel-Block (`:3738-3751`).
15. Toggle-Button neben `.terminal-toggle` (`:3609`).
16. Popup-Listener-Effekt: Die Main-Prozess-Grenze liefert bereits nur HTTP-/HTTPS-URLs; der Renderer normalisiert erneut und ruft erst dann `addBrowserTab(url)`.
17. STRINGS in beiden Blöcken.

**`src/styles.css`**

18. `.browser-toggle` nach `:1158`.
19. Grid-Regeln nach `:394`, Selektorgruppen bei `:396` und `:402` erweitern.
20. Panel-, Kopf-, Tab-, Toolbar- und View-Regeln nach dem Terminal-Block (`:1160`, `:1511-1674`), **einschließlich `.browser-view webview { width: 100%; height: 100% }`** (§4).

## 13. Phasen

Jede Phase endet mit `node --check electron/main.js`, NUL-Byte-Scan, `npm.cmd run build` und `npm.cmd run package`. Laufende `VantheaX`-Prozesse werden vorher sauber per WM_CLOSE beendet (FIXES #3). Danach startet der Agent die gepackte Exe, prüft das Fenster und die phasenspezifischen Interaktionen automatisiert und beendet den Prozess sauber. Kein Phase-Ergebnis wird ungeprüft an den User weitergegeben.

- **Phase 0: Spike (§3.1).** Nur `webviewTag: true`, die vollständige `will-attach-webview`-Validierung und ein hartverdrahtetes `<webview>` in einer Ecke, dazu Popup-, Attach-, Sandbox- und Permission-Tests. Beantwortet die sieben Fragen. Der Spike wird danach vollständig entfernt.
- **Phase 1: Panel und Layout.** Toggle, Grid-Klassen, Panel-Rahmen, Kopfzeile mit Tabs, `+`, Fullscreen, `X`, Resizer und `closeDockExcept`. Noch ohne Guest, die View-Fläche ist leer. Danach sind Rausfahren, Resizen und Panel-Exklusivität prüfbar, ohne dass eine einzige fremde Seite lädt.
- **Phase 2: Guest, Toolbar und vollständige Guest-Härtung.** `BrowserView`, Reducer, Adapter, Events, Toolbar, URL-Modul, feste Partition, `will-attach-webview`, sandboxed Guest-WebPreferences, vollständiger Permission-Deny, Download-Block, Mainframe- und Redirect-Schema-Wand, Popup-Deny, GET-Popup-zu-Tab und Fehlerzustand landen gemeinsam. **Kein fremder Inhalt wird auch nur für einen Zwischenbuild ohne diese Grenzen geladen.**
- **Phase 3: Oberfläche und Kompatibilitätsprüfung.** Vollständige i18n, finale Tab-Beschriftung, Fokusverhalten, Fullscreen-Verhalten, Redirects, `pushState`, Loopback-HTTP, Popup-Tabs, Guest-Absturz und alle Interaktionen aus §14 werden an der gepackten Exe geprüft und verbleibende UI-Fehler korrigiert.

Reihenfolge ist nicht beliebig: Phase 1 isoliert das Layout ohne Guest. Phase 2 führt fremde Inhalte erst zusammen mit der vollständigen Sicherheitsgrenze ein. Phase 3 verändert keine Sicherheitsarchitektur mehr, sondern prüft und poliert das fertige Verhalten.

## 14. Verifikation

**Isoliert und deterministisch:** `scripts/test-browser-url.mjs` importiert die echten Exporte aus `src/browser/browser-url.js` und prüft sie ohne Quelltext-Slicing oder `new Function`. Fälle:

- `example.com` → `https://example.com`
- `https://a.de/x?y=1` unverändert, `http://a.de` unverändert
- `localhost:5173` → `http://localhost:5173`, `http://localhost:5173` unverändert
- `localhost` → `http://localhost`
- `127.0.0.1:3000` → `http://127.0.0.1:3000`
- `[::1]:5173` → `http://[::1]:5173`
- `https://localhost:5173` bleibt als explizite Eingabe unverändert
- `example.com:8080/pfad` → `https://example.com:8080/pfad`
- `javascript:alert(1)`, `file:///C:/`, `data:text/html,x`, `chrome://settings`, `ws://x` → alle `null`
- `wie spaet ist es` → DuckDuckGo-URL mit korrekt kodierter Query
- Leerstring und reines Whitespace → `null`
- Führende und nachlaufende Leerzeichen werden getrimmt, nicht in die Suche gegeben
- `displayUrl("about:blank")` → `""`, `displayUrl("https://x.de")` → unverändert

**Lokale Fixture:** `scripts/browser-fixture.mjs` startet ohne neue Dependency einen HTTP-Server mit normaler Navigation, `pushState`, sicherem Redirect, Redirect auf ein verbotenes Schema, `target="_blank"`, `window.open`, POST-Popup, Download und Permission-Anfrage. Private LAN-Adressen werden nur mit explizitem `http://` geladen; ausschließlich Loopback erhält die bequeme automatische HTTP-Regel.

**Live an der gepackten App durch den Agenten zu prüfen:**

Panel fährt raus statt zu poppen; Breite ist ziehbar und mit Terminal geteilt; Fullscreen blendet den Chat aus; Terminal-Öffnen schließt den Browser sofort ohne Doppel-Panel-Frame und umgekehrt; **Terminal per X schließen und innerhalb einer Viertelsekunde wieder öffnen lässt die Tabs stehen** (der stale-Timer-Fall aus §5.4); **ein Klick auf eine Datei im Sidebar-Baum lässt ein offenes Terminal unangetastet**; das PanelSwitch-Dropdown schließt sich, wenn man darin Background Tasks wählt; zweiter Tab beschriftet die Leiste auf "Tab 1" / "Tab 2"; Zurück und Vorwärts sind korrekt ausgegraut, **auch auf einer `pushState`-Seite**; Refresh lädt neu; Enter in der Adressleiste navigiert; **Enter direkt nach dem Öffnen eines neuen Tabs navigiert oder lässt zumindest den Text stehen**; ein GET-`target="_blank"`-Link öffnet einen internen Tab, **der die Zielseite wirklich zeigt**; ein POST-Popup bleibt blockiert; sichere Redirects laden und Redirects auf verbotene Schemas werden abgebrochen; `localhost:<port>`, `127.0.0.1:<port>` und `[::1]:<port>` laden; ein Download-Link erzeugt keine Datei; alle Permission-Anfragen werden abgelehnt; ein manipuliertes Guest mit `preload`, falscher Partition oder unsicherer Start-URL wird vor dem Attach blockiert; das tatsächliche Guest läuft sandboxed; ein Klick ins Guest und danach Ctrl+B zeigt das Fokus-Verhalten aus §5.6.

## 15. Offene Punkte, ehrlich

1. **Webseiten-HTML5-Vollbild bleibt absichtlich aus.** Das Panel-Vollbild ist App-UI und benötigt keine Webseiten-Permission.
2. **Zoom.** `window:zoom` setzt den Zoom des Hauptfensters. Das Guest hat in v1 keinen eigenen Zoom-Regler.
3. **Speicherverbrauch.** Jeder Tab ist ein eigener Renderer-Prozess. Ein Tab-Limit ist für v1 nicht vorgesehen.
4. **DuckDuckGo als Such-Fallback** (§7 Regel 8) ist die festgelegte Standardsuche.
5. **Tabs sterben beim Schließen des Panels** (§10). Das verhindert unsichtbar weiterlaufende Seiten und Audio.

## 16. Hausregeln, die für diese Umsetzung binden

- Keine neuen Code-Kommentare. Kein `//`, kein `/* */`, keine TODOs und keine generierten Header-Kommentare. Nicht offensichtliche Entscheidungen bleiben im Plan und werden im Code durch klare Benennung ausgedrückt.
- Keine Em-Dashes, nirgends.
- Jeder neue sichtbare String in **beiden** Sprachblöcken, deutsche Strings mit Umlauten.
- `npm.cmd run package` nach jeder Phase. Der Agent startet und prüft ausschließlich die gepackte Exe, nie electron-on-dist, und beendet sie danach sauber.
- NUL-Byte-Scan nach größeren Edits, `node --check electron/main.js`.
- Ein Zugriffspunkt pro Grenze: `guestNav` ist der einzige Renderer-Weg zum Guest, `normalizeBrowserUrl` der einzige Renderer-Weg von Eingabe zu URL, `isBrowserGuestUrlAllowed` der einzige Main-Prozess-Validator für Guest-URLs und `closeDockExcept` der einzige Weg, die rechte Spalte umzuschalten. Kein Aufrufer greift daran vorbei.
