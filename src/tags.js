// 標籤系統核心 — 純資料與規則,不含任何繪圖。
// 設計理由見 docs/DESIGN_NOTES.md「核心機制:標籤系統」(2026-08-04)
//
// 四條規則:
//   1. 標籤不是屬性,是別人看你的方式 → 同一標籤在不同場合正負相反
//   2. 標籤不能刪除,只能遮
//   3. 遮蔽有成本(耐力)
//   4. 遮蔽會被拆穿,而且場合越不合理越容易被拆穿
//
// 不用 ES module,讓 file:// 直接雙擊開得起來(見 DESIGN_NOTES 末段)。

const TAGS = [
  {
    id: 'tattoo',
    name: '刺青',
    detail: '右手臂到手腕',
    cover: { label: '穿長袖', stamina: 2, baseExpose: 0.12 },
  },
  {
    id: 'accent',
    name: '口音',
    detail: '台語腔,講快會更明顯',
    cover: { label: '放慢、修正咬字', stamina: 3, baseExpose: 0.2 },
  },
  {
    id: 'record',
    name: '前科',
    detail: '18 歲那次,傷害罪',
    cover: { label: '不主動提', stamina: 1, baseExpose: 0.25 },
  },
  {
    id: 'dropout',
    name: '中輟',
    detail: '高二下沒讀完',
    cover: { label: '履歷寫「肄業」', stamina: 1, baseExpose: 0.3 },
  },
  {
    id: 'single',
    name: '單親',
    detail: '只有媽媽',
    cover: null, // 遮不了,也不該遮
  },
  {
    id: 'cheapmeal',
    name: 'i珍食',
    detail: '手上那個貼黃標的便當',
    cover: null, // 遮不了。長袖遮得住刺青,遮不住它。
  },
];

// weight: 負數 = 對方因此看低你,正數 = 這裡反而是籌碼,0 = 沒差
// line:   那一秒對方的反應。寫的是「別人怎麼看你」,不是角色本身可笑。
const SCENES = [
  {
    id: 'interview',
    name: '工地面試',
    sub: '下午兩點・35 度・鐵皮辦公室',
    heat: 2.5, // 這麼熱還穿長袖,遮蔽風險倍率
    tags: {
      tattoo: { w: -3, line: '工頭的眼睛在你手腕上停了半秒,然後就沒再看你了。' },
      accent: { w: +1, line: '「你台語會通齁?」他語氣鬆下來,這裡口音是自己人。' },
      record: { w: -4, line: '「有沒有案底?」他問得很隨口,像在問你吃飽沒。' },
      dropout: { w: -1, line: '他瞄了一眼學歷欄,沒說話。這行本來也不看這個。' },
      single: { w: 0, line: '沒人問你家裡的事。' },
      cheapmeal: { w: 0, line: '' },
    },
  },
  {
    id: 'bank',
    name: '銀行辦貸款',
    sub: '上午十點・冷氣很強・你穿了襯衫',
    heat: 0.6, // 冷氣房穿長袖很合理,遮得住
    tags: {
      tattoo: { w: -2, line: '行員的視線掃過你的袖口,又移開。' },
      accent: { w: -3, line: '你講到一半,她請你「再說一次」。第三次的時候你自己放慢了。' },
      record: { w: -5, line: '聯徵不會寫這個,但表格上有一欄要你自己勾。' },
      dropout: { w: -2, line: '「最高學歷」那格你想了三秒才動筆。' },
      single: { w: -1, line: '「保證人可以找爸爸嗎?」' },
      cheapmeal: { w: 0, line: '' },
    },
  },
  {
    id: 'debt',
    name: '討債現場',
    sub: '晚上・對方家門口・你只是跟著來',
    heat: 1.0,
    tags: {
      tattoo: { w: +4, line: '你把袖子捲上去。對面說話的音量小了一格。' },
      accent: { w: +2, line: '在這裡,你講話的方式讓人不敢隨便打斷。' },
      record: { w: +3, line: '有人提了一句你以前的事,那句話比你說什麼都有用。' },
      dropout: { w: 0, line: '這裡沒人問你讀到哪。' },
      single: { w: 0, line: '' },
      cheapmeal: { w: 0, line: '' },
    },
  },
  {
    id: 'store',
    name: '超商結帳',
    sub: '晚上八點・日光燈很亮・同班同學剛走進來',
    heat: 1.4,
    tags: {
      tattoo: { w: -1, line: '排在後面的阿姨往旁邊挪了半步。' },
      accent: { w: 0, line: '' },
      record: { w: 0, line: '' },
      dropout: { w: -2, line: '他知道你沒去學校了。他沒問,你也沒說。' },
      single: { w: 0, line: '' },
      cheapmeal: {
        w: -4,
        line: '他的視線落在你手上那張黃色標籤。他什麼都沒說,那才是最難受的。',
      },
    },
  },
];

// ── 規則 ──────────────────────────────────────────────

// 建立一個角色狀態。stamina 是遮蔽用的資源。
function createCharacter(tagIds, stamina = 10) {
  return {
    tags: tagIds.slice(),
    covered: [], // 這一場遮起來的標籤
    stamina,
    maxStamina: stamina,
  };
}

function getTag(id) {
  return TAGS.find((t) => t.id === id);
}

function getScene(id) {
  return SCENES.find((s) => s.id === id);
}

// 這個標籤在這一場能不能遮、遮了要付多少、會不會被拆穿。
function coverCost(tagId) {
  const tag = getTag(tagId);
  return tag && tag.cover ? tag.cover.stamina : null;
}

// 拆穿機率 = 標籤本身的破綻 × 場合的不合理程度。
// 35 度穿長袖,不是長袖有問題,是這個天氣有問題。
function exposeChance(tagId, sceneId) {
  const tag = getTag(tagId);
  const scene = getScene(sceneId);
  if (!tag || !tag.cover || !scene) return 0;
  return Math.min(0.95, tag.cover.baseExpose * scene.heat);
}

// 結算這一場:對方怎麼看你。
// 回傳每個標籤的實際結果 + 總分,不回傳「成功/失敗」——
// 這款遊戲沒有分數,只有別人的眼光。分數只是給開發者看的量尺。
function evaluate(character, sceneId, roll = Math.random) {
  const scene = getScene(sceneId);
  const results = [];
  let total = 0;

  for (const tagId of character.tags) {
    const entry = scene.tags[tagId];
    if (!entry) continue;

    const isCovered = character.covered.includes(tagId);
    let exposed = false;

    if (isCovered) {
      exposed = roll() < exposeChance(tagId, sceneId);
    }

    // 遮住且沒被拆穿 → 這個標籤這一場不存在
    // 遮住但被拆穿 → 照算,而且多一層「你剛剛想騙我」
    const active = !isCovered || exposed;
    const penalty = exposed && entry.w < 0 ? -1 : 0; // 被抓包的額外代價

    const w = active ? entry.w + penalty : 0;
    total += w;

    results.push({
      tagId,
      name: getTag(tagId).name,
      covered: isCovered,
      exposed,
      weight: w,
      line: exposed
        ? `你以為遮住了。${entry.line}`
        : active
          ? entry.line
          : '',
    });
  }

  return { scene, results, total, stamina: character.stamina };
}

// 遮一個標籤:扣耐力。耐力不夠就遮不了——
// 這是重點,越累的人越沒有本錢裝。
function cover(character, tagId) {
  const cost = coverCost(tagId);
  if (cost === null) return { ok: false, reason: '這個遮不了' };
  if (character.covered.includes(tagId)) return { ok: false, reason: '已經遮了' };
  if (character.stamina < cost) return { ok: false, reason: '沒力氣了' };

  character.covered.push(tagId);
  character.stamina -= cost;
  return { ok: true };
}

function uncover(character, tagId) {
  const i = character.covered.indexOf(tagId);
  if (i === -1) return { ok: false };
  character.covered.splice(i, 1);
  character.stamina = Math.min(character.maxStamina, character.stamina + coverCost(tagId));
  return { ok: true };
}
