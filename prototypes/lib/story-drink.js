/* no-way-up — 劇情線:父親・酗酒(接 FAMILIES 的 dad:'drink')
 *
 * 純資料,不碰 DOM。格式同 story-bet.js,直接餵給 say()/openMenu()/chg()/toast()。
 *
 * 核心:他不跟你要錢,錢自己會不見。而他不是在騙你 —— 他是真的不記得。
 *   所以你失去的不是那幾百塊,是**相信自己記得**的能力。
 *   最後你變成一個每天回家先數錢的人。那才是他真正拿走的東西。
 *
 * ⚠ 支線,不是主軸,四到五個節點就好。見 DESIGN_NOTES「家裡的拉扯」。
 */
(function (root) {

  const NODES = [

    /* ── 第 4 天 ── 第一次 ── */
    {
      day: 4,
      title: '不見了',
      beats: [
        { who:'pc',  text:'你鉛筆盒裡的兩百塊不見了。' },
        { who:'pc',  text:'你昨天放的。你記得很清楚，\n因為你數過。' }
      ],
      menu: [
        {
          label: '問他',
          cost: '歸屬感 −6',
          calm: -6,
          beats: [
            { who:'dad', text:'「什麼兩百塊。」' },
            { who:'pc',  text:'他沒有心虛，也沒有生氣。\n他就是不知道你在說什麼。' },
            { toast:'你開始懷疑是不是自己記錯了。', ms:3400 }
          ]
        },
        {
          label: '算了',
          cost: '歸屬感 −3',
          calm: -3,
          beats: [
            { who:'pc',  text:'你把鉛筆盒收起來。' },
            { toast:'你沒有問。你已經知道問了會怎樣。', ms:3000 }
          ]
        }
      ]
    },

    /* ── 第 9 天 ── 你開始藏 ── */
    {
      day: 9,
      title: '藏',
      beats: [
        { who:'pc',  text:'今天發薪水。\n\n你站在房間中間，手上拿著錢。' }
      ],
      menu: [
        {
          label: '夾在課本裡',
          cost: '',
          beats: [
            { who:'pc',  text:'第 214 頁。你記下來了。' },
            { toast:'你在自己家裡找地方藏東西。', ms:3200 }
          ]
        },
        {
          label: '一直帶在身上',
          cost: '歸屬感 −5',
          calm: -5,
          beats: [
            { who:'pc',  text:'你把錢摺起來，塞進襪子。' },
            { who:'pc',  text:'走路的時候會感覺到它。\n整天都會。' },
            { toast:'最安全的地方是你身上。這件事本身就有問題。', ms:3600 }
          ]
        }
      ]
    },

    /* ── 第 15 天 ── 他睡在地上 ── */
    {
      day: 15,
      title: '他睡在地上',
      beats: [
        { who:'pc',  text:'你回到家，客廳沒有開燈。' },
        { who:'pc',  text:'他睡在地板上，沙發是空的。\n旁邊有一罐倒了的酒，\n流出來的部分已經乾了。' }
      ],
      menu: [
        {
          label: '扶他起來',
          cost: '歸屬感 −4',
          calm: -4,
          beats: [
            { who:'pc',  text:'他比你想的還要輕。' },
            { who:'dad', text:'「⋯⋯你回來啦。」' },
            { who:'pc',  text:'他認得出是你。\n\n你不知道這樣算好還是不好。' },
            { toast:'你把他放到沙發上，然後去把地板擦乾淨。', ms:3800 }
          ]
        },
        {
          label: '跨過去',
          cost: '歸屬感 −8',
          calm: -8,
          beats: [
            { who:'pc',  text:'你跨過他，走回房間。' },
            { who:'pc',  text:'你躺下來以後，一直在聽\n外面有沒有聲音。' },
            { toast:'你其實在確認他還有沒有在呼吸。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 20 天 ── 這一刀最利:他不是在騙你 ── */
    {
      day: 20,
      title: '他記得',
      beats: [
        { who:'dad', text:'「欸。」' },
        { who:'dad', text:'「上次那兩百塊，\n　我後來有放回去。」' },
        { who:'pc',  text:'他沒有放回去。' },
        { who:'pc',  text:'但他不是在騙你。\n\n他是真的以為他放了。' }
      ],
      menu: [
        {
          label: '「喔，好。」',
          cost: '歸屬感 −10',
          calm: -10,
          beats: [
            { who:'pc',  text:'他很滿意，轉頭繼續看電視。' },
            { toast:'你發現你寧願他是在騙你。', ms:3600 }
          ]
        },
        {
          label: '「你沒有。」',
          cost: '歸屬感 −14',
          calm: -14,
          beats: [
            { who:'dad', text:'「我有啊。」' },
            { who:'dad', text:'「我記得很清楚。」' },
            { who:'pc',  text:'他真的記得。\n\n他記得一件沒有發生過的事，\n而且記得很清楚。' },
            { toast:'你沒有辦法跟這個爭。', ms:3800 }
          ]
        }
      ]
    },

    /* ── 第 26 天 ── 他真正拿走的東西 ── */
    {
      day: 26,
      title: '你數過了',
      beats: [
        { who:'pc',  text:'你回到家，開燈，關門，\n把包包放下。' },
        { who:'pc',  text:'然後你數錢。' },
        { who:'pc',  text:'你不是今天才這樣。\n你已經這樣一個多月了。' }
      ],
      menu: [
        {
          label: '把錢收好',
          cost: '歸屬感 −6',
          calm: -6,
          beats: [
            { who:'pc',  text:'一千三百二。跟早上一樣。' },
            { who:'pc',  text:'你鬆了一口氣。' },
            { who:'pc',  text:'然後你發現自己在為了\n「錢沒有被偷」而鬆一口氣。' },
            { toast:'你變成一個回家第一件事是數錢的人。', ms:4200 }
          ]
        },
        {
          label: '今天不數',
          cost: '歸屬感 −9',
          calm: -9,
          beats: [
            { who:'pc',  text:'你把包包丟到床上，躺下來。' },
            { who:'pc',  text:'你躺了三分鐘。' },
            { who:'pc',  text:'然後你起來數了。' },
            { toast:'你已經停不下來了。', ms:3800 }
          ]
        }
      ]
    }
  ];

  root.StoryDrink = { NODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
