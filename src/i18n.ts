export type Lang = "ja" | "en";

const dict = {
  ja: {
    appTitle: "TimelineFlow",
    tagline: "実験タイムライン模式図メーカー",
    undo: "元に戻す", redo: "やり直す",
    saveJson: "JSON保存", loadJson: "JSON読込", exportSvg: "SVG書き出し", reset: "サンプルに戻す",
    confirmReset: "現在の内容を破棄してサンプルに戻しますか?",
    loadError: "ファイルを読み込めませんでした。",
    events: "イベント", addEvent: "+ イベント追加", sortEvents: "時間順に並べ替え",
    time: "時間", date: "実日付", text: "ボックス内テキスト", labelOverride: "時間ラベル(手動上書き)",
    side: "配置側", sideAuto: "自動", sideAbove: "軸の上", sideBelow: "軸の下",
    style: "見た目", fill: "塗り", stroke: "枠線色", strokeWidth: "枠線(pt)", dashed: "破線", shape: "形状",
    shapeRounded: "角丸", shapeRect: "四角", shapeNone: "枠なし", resetStyle: "既定に戻す",
    duplicate: "複製", delete: "削除",
    markupHelp: "記法: **太字** *斜体* ^上付き^ ~下付き~(例: Ca^2+^、H~2~O、*BGLF4*)",
    settings: "全体設定",
    gCanvas: "キャンバス・文字", gAxis: "時間軸", gDate: "実日付", gBox: "ボックス", gConn: "矢印(引き出し線)",
    widthMm: "幅(mm)", font: "フォント", fontSize: "文字サイズ(pt)", labelFontSize: "時間ラベル(pt)",
    background: "背景", bgTransparent: "透明", bgWhite: "白",
    unit: "単位", unitCustom: "任意", customUnit: "単位名", mode: "配置",
    modeProportional: "時間に比例", modeEqual: "等間隔", arrow: "矢印の先端", axisWidth: "線幅(pt)", axisColor: "色",
    ticks: "目盛り", ticksNone: "なし", ticksEvents: "イベント位置", ticksUnit: "単位ごと",
    dateStart: "Day 0の日付", dateMode: "表示", dateNone: "なし", dateOnly: "日付のみ", dateBoth: "併記",
    dateFormat: "書式", dateLayout: "併記の形", layoutInline: "1行", layoutTwoline: "2行",
    dateNeedStart: "日付はDay/Week/Hour単位で起点日を入れると使えます。",
    alternate: "近接時は上下交互に配置", uniformHeight: "高さをそろえる",
    minWidth: "最小幅(px)", minHeight: "最小高さ(px)", padX: "左右余白(px)", padY: "上下余白(px)", radius: "角丸(px)",
    align: "文字揃え", alignCenter: "中央", alignLeft: "左", valign: "縦位置", valignTop: "上", valignMiddle: "中央",
    connStyle: "矢印", connToAxis: "軸へ向く", connToBox: "ボックスへ向く", connNone: "なし", connLength: "長さ(px)", connWidth: "線幅(pt)",
    overlapWarn: (n: number) => `${n}個のボックスが重なっています。幅や文字量を調整してください。`,
    privacy: "入力データは端末内でのみ処理され、外部へ送信されません。",
    previewHint: "ボックスをクリックすると左の入力欄が選択されます。",
    empty: "イベントを追加してください。",
    categories: "種別(色分け・凡例)", addCategory: "+ 種別追加", catName: "種別名", category: "種別", noCategory: "(なし)",
    periods: "期間バー", addPeriod: "+ 期間追加", periodStart: "開始", periodEnd: "終了", periodText: "ラベル",
    breaks: "軸の中断(//)", addBreak: "+ 中断追加", breakFrom: "from", breakTo: "to", breakHint: "「時間に比例」配置のときのみ有効です。区間は短く圧縮されます。",
    periodPos: "期間バーの位置", posBottom: "下", posTop: "上", periodHeight: "バー高さ(px)", endShape: "バー端の形", shapeSquare: "四角", shapeRound: "丸", shapeArrow: "矢印",
    legend: "凡例を表示", gPeriod: "期間バー・凡例",
    tsvOpen: "表から貼り付け", tsvTitle: "表(TSV)から一括入力",
    tsvHelp: "Excel/スプレッドシートからコピーして貼り付けます。列: 時間 | 内容 | 種別(省略可)。時間に「1-3」と書くと期間バーになります。内容の改行は \\n と書きます。1行目の見出しは自動で無視されます。",
    tsvAppend: "追加", tsvReplace: "置き換え", tsvCancel: "キャンセル", tsvDone: "取り込みました",
    template: "テンプレート", templatePick: "テンプレートから開始…", confirmTemplate: "現在の内容を破棄してテンプレートから始めますか?",
    exportText: "SVG(編集用)", exportOutline: "SVG(アウトライン)",
    fontOutline: "アウトライン用フォント", fontBundled: "Noto Sans JP(同梱、OFL)", fontLoaded: "読み込み済み: ", fontLoad: "フォントファイルを選択…",
    fontMissing: "同梱フォントが見つかりません。「フォントファイルを選択」で .ttf/.otf/.woff を読み込んでください。",
    fontFail: "フォントを読み込めませんでした。",
    outlineHint: "文字をパスに変換します(フォント未インストール環境でも崩れません)。元の文字列は各要素のaria-labelに残ります。",
    freeSpace: "下の自由スペース(px)", note: "補足(吹き出しの下)", resetPos: "位置をリセット",
    texts: "自由テキスト", addText: "+ 自由テキスト追加", textHint: "図の余白をダブルクリックしても追加できます。ドラッグで移動、Deleteで削除。",
    freeHint: "自由スペース:ダブルクリックで文字を追加", textPlaceholder: "テキスト",
    dragHint: "ボックス・時間ラベル・補足・自由テキストはドラッグで移動できます。ボックスを選ぶと矢印の両端に丸いハンドルが出て、ドラッグで先端の位置を調整できます(ダブルクリックで元の位置へ)(Shiftで水平/垂直に固定)。ダブルクリックで図の上から直接編集(B/Iボタン、または Ctrl/⌘+B・I・.・, で太字・斜体・上付き・下付き)、余白をダブルクリックで自由テキストを追加します。",
    lang: "言語",
  },
  en: {
    appTitle: "TimelineFlow",
    tagline: "Experiment timeline figure maker",
    undo: "Undo", redo: "Redo",
    saveJson: "Save JSON", loadJson: "Load JSON", exportSvg: "Export SVG", reset: "Reset to sample",
    confirmReset: "Discard the current content and reset to the sample?",
    loadError: "Could not read the file.",
    events: "Events", addEvent: "+ Add event", sortEvents: "Sort by time",
    time: "Time", date: "Date", text: "Box text", labelOverride: "Time label (override)",
    side: "Side", sideAuto: "Auto", sideAbove: "Above axis", sideBelow: "Below axis",
    style: "Style", fill: "Fill", stroke: "Stroke", strokeWidth: "Stroke (pt)", dashed: "Dashed", shape: "Shape",
    shapeRounded: "Rounded", shapeRect: "Rectangle", shapeNone: "No box", resetStyle: "Reset to default",
    duplicate: "Duplicate", delete: "Delete",
    markupHelp: "Markup: **bold** *italic* ^superscript^ ~subscript~ (e.g. Ca^2+^, H~2~O, *BGLF4*)",
    settings: "Settings",
    gCanvas: "Canvas & text", gAxis: "Time axis", gDate: "Calendar date", gBox: "Boxes", gConn: "Connector arrows",
    widthMm: "Width (mm)", font: "Font", fontSize: "Font size (pt)", labelFontSize: "Time label (pt)",
    background: "Background", bgTransparent: "Transparent", bgWhite: "White",
    unit: "Unit", unitCustom: "Custom", customUnit: "Unit name", mode: "Spacing",
    modeProportional: "Proportional to time", modeEqual: "Equal spacing", arrow: "Arrowhead", axisWidth: "Width (pt)", axisColor: "Color",
    ticks: "Ticks", ticksNone: "None", ticksEvents: "At events", ticksUnit: "Every unit",
    dateStart: "Date of Day 0", dateMode: "Show", dateNone: "None", dateOnly: "Date only", dateBoth: "Both",
    dateFormat: "Format", dateLayout: "Layout", layoutInline: "One line", layoutTwoline: "Two lines",
    dateNeedStart: "Dates work with Day/Week/Hour units once a start date is set.",
    alternate: "Alternate above/below when close", uniformHeight: "Uniform height",
    minWidth: "Min width (px)", minHeight: "Min height (px)", padX: "Horizontal padding (px)", padY: "Vertical padding (px)", radius: "Corner radius (px)",
    align: "Text align", alignCenter: "Center", alignLeft: "Left", valign: "Vertical", valignTop: "Top", valignMiddle: "Middle",
    connStyle: "Arrow", connToAxis: "Toward axis", connToBox: "Toward box", connNone: "None", connLength: "Length (px)", connWidth: "Width (pt)",
    overlapWarn: (n: number) => `${n} box(es) overlap. Adjust widths or text.`,
    privacy: "Your data is processed only in this browser and is never sent anywhere.",
    previewHint: "Click a box to jump to its fields on the left.",
    empty: "Add an event to start.",
    categories: "Categories (colors & legend)", addCategory: "+ Add category", catName: "Name", category: "Category", noCategory: "(none)",
    periods: "Period bars", addPeriod: "+ Add period", periodStart: "Start", periodEnd: "End", periodText: "Label",
    breaks: "Axis breaks (//)", addBreak: "+ Add break", breakFrom: "from", breakTo: "to", breakHint: "Only with proportional spacing. The interval is compressed to a short span.",
    periodPos: "Period bar position", posBottom: "Bottom", posTop: "Top", periodHeight: "Bar height (px)", endShape: "Bar end shape", shapeSquare: "Square", shapeRound: "Round", shapeArrow: "Arrow",
    legend: "Show legend", gPeriod: "Period bars & legend",
    tsvOpen: "Paste table", tsvTitle: "Bulk input from a table (TSV)",
    tsvHelp: "Copy from Excel / a spreadsheet and paste. Columns: time | text | category (optional). A time like \"1-3\" makes a period bar. Write \\n for a line break inside the text. A header row is ignored automatically.",
    tsvAppend: "Append", tsvReplace: "Replace", tsvCancel: "Cancel", tsvDone: "Imported",
    template: "Template", templatePick: "Start from a template…", confirmTemplate: "Discard the current content and start from the template?",
    exportText: "SVG (editable)", exportOutline: "SVG (outlined)",
    fontOutline: "Font for outlines", fontBundled: "Noto Sans JP (bundled, OFL)", fontLoaded: "Loaded: ", fontLoad: "Choose a font file…",
    fontMissing: "The bundled font was not found. Use \"Choose a font file\" to load a .ttf/.otf/.woff.",
    fontFail: "Could not load the font.",
    outlineHint: "Converts text to paths so it renders identically without the font installed. The original string stays in each element's aria-label.",
    freeSpace: "Free space below (px)", note: "Note (below the box)", resetPos: "Reset positions",
    texts: "Free text", addText: "+ Add free text", textHint: "You can also double-click blank space on the figure. Drag to move, Delete to remove.",
    freeHint: "Free space: double-click to add text", textPlaceholder: "Text",
    dragHint: "Drag boxes, time labels, notes and free text to move them. Select a box to show round handles at both ends of its arrow; drag them to place the arrow tip (double-click to reset) (hold Shift to lock horizontal/vertical). Double-click to edit directly on the figure (B/I buttons, or Ctrl/⌘+B, I, ., , for bold, italic, super/subscript); double-click blank space to add free text.",
    lang: "Language",
  },
} as const;

type Dict = (typeof dict)["ja"];
export type Key = keyof Dict;

let lang: Lang = "ja";
export function setLang(l: Lang): void { lang = l; }
export function getLang(): Lang { return lang; }
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem("timelineflow:lang");
    if (saved === "ja" || saved === "en") return saved;
  } catch { /* ignore */ }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}
export function saveLang(l: Lang): void {
  try { localStorage.setItem("timelineflow:lang", l); } catch { /* ignore */ }
}
export function t(k: Exclude<Key, "overlapWarn">): string {
  return dict[lang][k] as string;
}
export function overlapWarn(n: number): string {
  return dict[lang].overlapWarn(n);
}
