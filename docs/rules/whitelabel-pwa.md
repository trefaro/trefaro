# Whitelabel und PWA

Wie das Whitelabel-Design und die PWA-Seite dieser Anwendung geschnitten sind.

Eine Organisation soll ihre Instanz brandbar und installierbar
bekommen, ohne dass dabei Trefaros Name, Trefaros Icon oder ein unlesbarer
Kontrast auf ihrem Startbildschirm landet.

- **Farben nur als Hex** (E17) — `readableTextColor` muss den Kontrast
  entscheiden können; was es nicht parst, bekommt Weiß.
- **Text auf einer Markenfarbe kann nicht zu blass werden** (F67).
  `readableTextColor` wählt an der Kreuzungsluminanz, das Verhältnis liegt immer
  bei ≥ ≈ 4,58:1 (`MIN_DERIVED_TEXT_CONTRAST`) — ein Hinweis „unter 4,5:1 gegen
  die berechnete Textfarbe" kann deshalb **nie** auslösen und ist eine angezeigte
  Tatsache, keine Prüfung. Gewarnt wird bei der **Primärfarbe gegen die weiße
  Seite unter 3:1** (sie ist die Fläche und die Quelle der Linkfarbe). Die
  **Akzentfarbe** bekommt **keine** Warnung — sie ist immer _in_ etwas, und die
  Vorgabe `#e8a33d` liegt bei 2,2:1, eine Warnung erschiene ab Werk. Der
  Fokusring beider Clients nimmt `--trefaro-color-accent-strong`.
- **Schriftarten sind ein mitgelieferter, selbst gehosteter Katalog** (E18) — kein
  Google-Fonts-CDN, kein Upload (vorerst).
- **`/api/media/branding/…` nimmt keinen Pfad vom Aufrufer** (E19). Branding ist
  öffentlich, Anhänge nicht (E9) — die zwei Dateiarten dürfen nicht in einer URL
  verwechselbar sein. Eigener `branding/`-Teilbaum im Upload-Volume, `CHECK` auf
  beide Pfadspalten, Typ aus den ersten Bytes, **kein SVG**.
- **Ein Bild wird beim Hochladen geschrieben, nicht beim Speichern** — zwei
  Schritte je Bild, und „Discard changes" erfasst es ausdrücklich nicht.
- **Das Manifest kommt vom Server**, gebaut aus der Konfiguration (E26, F103):
  `GET /api/config/manifest.webmanifest` in `business/manifest/`, einem Modul über
  `ConfigurationModule` und `I18nModule`. Ein statisches Manifest im Client-Image
  gibt es nicht mehr — und was aus `public/` verschwindet, verschwindet auch aus
  `ngsw-config.json`.
- **Ein Manifest hat keine Sprachwahl** (F104): der Browser holt es aus einem
  `<link>`, während jemand installiert → Vorgabesprache der Instanz + `lang`,
  genau wie bei einer Mail. Kein `?locale=`.
- **Ein hochgeladenes App-Icon ist nie `maskable`** (F105) — nur die
  mitgelieferten Icons tragen den Schutzrand, weil sie mit einem gezeichnet
  wurden. Es **ersetzt** sie nur, wenn ein Browser davon installieren kann:
  quadratisch und ≥ `MIN_INSTALLABLE_ICON_PX` (144). Sonst steht es davor und die
  mitgelieferten dahinter — die eine Fehlrichtung wäre Trefaros Icon auf einem
  fremden Startbildschirm, die andere eine Instanz, die sich nicht installieren
  lässt.
- **Maße aus dem Dateikopf zu lesen ist keine Prüfung** (F106): kein Upload wird
  wegen seiner Form abgelehnt, keine Spalte speichert eine. `imageDimensions`
  (neben `file-signature.ts`) liest PNG, JPEG und alle drei WebP-Formen, damit das
  Manifest eine Größe **nennen** kann; sagt der Kopf nichts, heißt es
  `sizes: "any"`. Wer eine Bildeigenschaft braucht: aus den Bytes lesen, nicht in
  eine zweite Spalte schreiben.
- **`SHIPPED_APP_ICONS` ist ein Vertrag zwischen zwei Projekten** (F107): der
  Server schreibt die Pfade, der Nutzer-Client beantwortet sie — deshalb steht die
  Liste in `shared-models` und ein Clienttest prüft jeden `src` gegen
  `public/icons`.
- **`theme-color` schreibt der `ThemeService`** (F108), nicht `index.html`; der
  Wert im Dokument ist die Farbe **vor** der Konfiguration. Gilt für beide Clients.
- **Ein Hinweis, den man nicht befolgen kann, ist Werbung** (F109): der
  Installationshinweis existiert nur hinter `beforeinstallprompt` — auf iOS und in
  Firefox steht nichts. Das abgefangene Ereignis ist einmal benutzbar;
  installieren, „jetzt nicht" (`localStorage`) und `appinstalled` beenden das
  Angebot dauerhaft. Das `apple-touch-icon` folgt der Konfiguration (iOS liest
  kein Manifest-Icon).
- **`navigator.onLine` ist asymmetrisch** (F110): `false` ist eine Aussage, `true`
  ist keine (ein WLAN mit Anmeldeseite meldet `true`). Das Offline-Banner erscheint
  nur bei `false` und behauptet nie die Gegenrichtung; jede Seite behält ihre
  eigene Fehlermeldung.
- **Eine Kachel gibt es nur, wo etwas dahinter ist** (F68, F47) — nicht je
  aktiviertem Modul. Kein Eintrag für ein Modul, das es noch nicht gibt; ein
  Plug-in, dessen Bundle nicht geladen hat, bekommt keine.

Siehe auch: [Fallen in den Angular-Clients](angular-clients.md), [Mehrsprachigkeit und Katalog](i18n.md), [Deployment und Prüfung](deployment.md).
