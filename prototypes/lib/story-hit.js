/* no-way-up — 劇情線:父親・脾氣(接 FAMILIES 的 dad:'hit')
 *
 * 純資料,不碰 DOM。格式同 story-bet.js。
 *
 * 核心:他不要錢,他要你聽話。你在自己家裡要算路線。
 *   這條線的機制是**空間**,不是金錢 —— 走哪條路進房間、要不要回話、
 *   身體比你先站起來。
 *
 * ⚠ 不要演暴力。這條線從頭到尾沒有一拳打下去,
 *   痛的是**你已經先做好準備了**。畫出來的暴力是獵奇,
 *   算路線才是這個處境真正的樣子。見 DESIGN_NOTES「色調原則」。
 */
(function (root) {

  const NODES = [

    /* ── 第 4 天 ── 現在遊戲裡已經有的那一段,當作起點 ── */
    {
      day: 4,
      title: '那不是問句',
      beats: [
        { who:'dad', text:'「你去哪裡。」' }
      ],
      menu: [
        {
          label: '「打工。」',
          cost: '歸屬感 −12',
          calm: -12,
          beats: [
            { who:'dad', text:'「打什麼工。」' },
            { who:'pc',  text:'那不是問句。' },
            { toast:'你回房間的路只有六步，你走得很慢。', ms:3400 }
          ]
        },
        {
          label: '不回答',
          cost: '歸屬感 −16',
          calm: -16,
          beats: [
            { who:'pc',  text:'你直接往房間走。' },
            { who:'dad', text:'「我在跟你講話。」' },
            { who:'pc',  text:'你停下來，但沒有回頭。' },
            { toast:'那六步你走了很久。', ms:3400 }
          ]
        }
      ]
    },

    /* ── 第 8 天 ── 你開始算路線 ── */
    {
      day: 8,
      title: '後陽台',
      beats: [
        { who:'pc',  text:'你站在樓下，抬頭看客廳的燈。' },
        { who:'pc',  text:'亮的。' }
      ],
      menu: [
        {
          label: '從後陽台繞',
          cost: '歸屬感 −3',
          calm: -3,
          beats: [
            { who:'pc',  text:'要多走兩分鐘，\n而且要從隔壁的曬衣區跨過去。' },
            { who:'pc',  text:'但這條路不會經過客廳。' },
            { toast:'你已經知道哪一條路不會遇到他。', ms:3600 }
          ]
        },
        {
          label: '走大門',
          cost: '歸屬感 −10',
          calm: -10,
          beats: [
            { who:'pc',  text:'你在門口站了十秒才開門。' },
            { who:'pc',  text:'他在看電視，沒有回頭。' },
            { who:'pc',  text:'什麼都沒有發生。' },
            { toast:'但你進房間之後，手還是抖的。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 13 天 ── 他心情好,你反而更緊張 ── */
    {
      day: 13,
      title: '他今天心情好',
      beats: [
        { who:'dad', text:'「欸，要不要吃宵夜。」' },
        { who:'pc',  text:'他在笑。' },
        { who:'pc',  text:'你不知道哪一句會翻。' }
      ],
      menu: [
        {
          label: '坐下來吃',
          cost: '飽足 +12　歸屬感 +4',
          full: 12, calm: +4,
          beats: [
            { who:'pc',  text:'他叫了兩份鹹酥雞。' },
            { who:'dad', text:'「你以前不是很愛吃這個。」' },
            { who:'pc',  text:'他記得。' },
            { who:'pc',  text:'你整餐都在等他問你錢的事，\n但他沒有問。' },
            { toast:'你吃完了，可是你不記得味道。', ms:4000 }
          ]
        },
        {
          label: '「我吃過了。」',
          cost: '歸屬感 −9',
          calm: -9,
          beats: [
            { who:'dad', text:'「⋯⋯喔。」' },
            { who:'pc',  text:'他把袋子放到桌上，沒有再說話。' },
            { who:'pc',  text:'隔天早上袋子還在那裡，沒有動過。' },
            { toast:'你不知道自己是不是搞砸了什麼。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 19 天 ── 身體比你先反應 ── */
    {
      day: 19,
      title: '碗',
      beats: [
        { who:'pc',  text:'一個碗掉在地上。' },
        { who:'pc',  text:'不是丟的，是滑掉的。' },
        { who:'pc',  text:'但你已經站起來了。' }
      ],
      menu: [
        {
          label: '去撿',
          cost: '歸屬感 −11',
          calm: -11,
          beats: [
            { who:'pc',  text:'你蹲下去撿碎片。' },
            { who:'dad', text:'「⋯⋯你緊張什麼。」' },
            { who:'pc',  text:'他是真的在問。' },
            { toast:'他不知道你為什麼會這樣。他真的不知道。', ms:4200 }
          ]
        },
        {
          label: '站在原地',
          cost: '歸屬感 −13',
          calm: -13,
          beats: [
            { who:'pc',  text:'你的手已經舉到胸口了。' },
            { who:'pc',  text:'你自己看到才放下來。' },
            { toast:'你的身體比你早六年就學會了。', ms:4000 }
          ]
        }
      ]
    },

    /* ── 第 25 天 ── 最狠的一刀是你自己的念頭 ── */
    {
      day: 25,
      title: '他站起來要扶桌子',
      beats: [
        { who:'pc',  text:'他從沙發上站起來，\n手撐了一下桌角。' },
        { who:'pc',  text:'你第一個念頭不是心疼。' },
        { who:'pc',  text:'你的第一個念頭是\n「他打不動我了」。' }
      ],
      menu: [
        {
          label: '去扶他',
          cost: '歸屬感 −8',
          calm: -8,
          beats: [
            { who:'pc',  text:'他甩開你的手。' },
            { who:'dad', text:'「我又不是不能走。」' },
            { who:'pc',  text:'他走回房間，門帶得很大聲。' },
            { toast:'那個聲音你聽了很多年，今天第一次覺得它很小。', ms:4400 }
          ]
        },
        {
          label: '回自己房間',
          cost: '歸屬感 −12',
          calm: -12,
          beats: [
            { who:'pc',  text:'你躺下來，一直想著剛剛那個念頭。' },
            { who:'pc',  text:'然後你為那個念頭覺得噁心。' },
            { who:'pc',  text:'你不知道自己是什麼時候\n變成會這樣想的人的。' },
            { toast:'你睡不著。', ms:3800 }
          ]
        }
      ]
    }
  ];

  root.StoryHit = { NODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
