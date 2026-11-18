import { defaultSettings, newCategory, newEvent, newPeriod } from "./model.ts";
import type { Project } from "./model.ts";
import type { Lang } from "./i18n.ts";

export interface Template {
  id: string;
  name: string;
  build: () => Project;
}

export function templates(lang: Lang): Template[] {
  const ja = lang === "ja";
  const L = (j: string, e: string) => (ja ? j : e);

  return [
    {
      id: "seed-treat-harvest",
      name: L("細胞播種 → 処理 → 回収", "Seed → treat → harvest"),
      build: () => {
        const cats = [newCategory(L("播種", "Seeding"), 0), newCategory(L("処理", "Treatment"), 1), newCategory(L("回収・解析", "Harvest / analysis"), 2)];
        const p: Project = { version: 1, settings: defaultSettings(), events: [], periods: [], categories: cats, breaks: [] };
        const e = (t: number, text: string, c: number) => { const ev = newEvent(t, text); ev.category = cats[c].id; return ev; };
        p.events = [e(0, L("細胞播種", "Seed cells"), 0), e(1, L("薬剤添加", "Add drug"), 1), e(3, L("培地交換", "Medium change"), 1), e(5, L("細胞回収\nPCR", "Harvest cells\nPCR"), 2)];
        return p;
      },
    },
    {
      id: "virus-infection",
      name: L("ウイルス感染実験(hpi)", "Virus infection (hpi)"),
      build: () => {
        const cats = [newCategory(L("感染", "Infection"), 0), newCategory(L("洗浄・処理", "Wash / treat"), 1), newCategory(L("回収", "Harvest"), 2)];
        const s = defaultSettings();
        s.axis.unit = "Hour";
        const p: Project = { version: 1, settings: s, events: [], periods: [], categories: cats, breaks: [] };
        const e = (t: number, text: string, c: number) => { const ev = newEvent(t, text); ev.category = cats[c].id; return ev; };
        p.events = [e(0, L("ウイルス感染\n(MOI = 1)", "Infect\n(MOI = 1)"), 0), e(2, L("PBS洗浄\n培地交換", "PBS wash\nmedium change"), 1), e(24, L("RNA回収\nRT-qPCR", "Harvest RNA\nRT-qPCR"), 2), e(48, L("上清回収\n力価測定", "Harvest supernatant\ntitration"), 2)];
        const pe = newPeriod(0, 2, L("吸着", "Adsorption"));
        pe.category = cats[0].id;
        p.periods = [pe];
        return p;
      },
    },
    {
      id: "drug-selection",
      name: L("薬剤選択とクローニング", "Drug selection & cloning"),
      build: () => {
        const cats = [newCategory(L("遺伝子導入", "Transfection"), 0), newCategory(L("薬剤選択", "Selection"), 1), newCategory(L("クローン単離", "Cloning"), 2)];
        const p: Project = { version: 1, settings: defaultSettings(), events: [], periods: [], categories: cats, breaks: [] };
        const e = (t: number, text: string, c: number) => { const ev = newEvent(t, text); ev.category = cats[c].id; return ev; };
        p.events = [e(0, L("トランスフェクション", "Transfection"), 0), e(2, L("薬剤選択開始\n(Puromycin)", "Start selection\n(puromycin)"), 1), e(14, L("コロニー\nピックアップ", "Pick colonies"), 2), e(28, L("クローン拡大\n凍結保存", "Expand clones\nfreeze stocks"), 2)];
        const pe = newPeriod(2, 14, L("薬剤選択", "Selection"));
        pe.category = cats[1].id;
        p.periods = [pe];
        return p;
      },
    },
  ];
}
