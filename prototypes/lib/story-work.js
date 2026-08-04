/* no-way-up — 劇情線:母親・兩份工(接 FAMILIES 的 mom:'work')
 *
 * 純資料,不碰 DOM。格式同 story-bet.js。
 *
 * 核心:**這一條沒有加害者。** 她不拿你的錢,她給你錢;她不罵你,她只是不在。
 *   你沒有敵人,你只是沒有人。
 *
 * ⚠ 這條線非做不可,而且不能寫壞。理由:
 *   如果每個父母都是加害者,這個遊戲就變成「底層的家庭都很糟」的展示——
 *   那正好違反基準線(見 CLAUDE.md:你站不站在角色那一邊)。
 *   有這一條在,玩家才知道遊戲講的是**處境**,不是**人品**。
 *
 * 寫法:全程克制,不要煽情,不要讓任何人講出「我是為了你」。
 * 最後一節兩個人都在偷偷養對方,誰都沒有說 —— 到那裡就停,不要再補一句。
 */
(function (root) {

  const NODES = [

    /* ── 第 5 天 ── 她已經走了 ── */
    {
      day: 5,
      title: '碗下面',
      beats: [
        { who:'pc',  text:'桌上有兩百塊，壓在碗下面。' },
        { who:'pc',  text:'她五點就出門了。\n第二份工在早市。' }
      ],
      menu: [
        {
          label: '收起來',
          cost: '',
          beats: [
            { who:'pc',  text:'你把錢摺好放進口袋。' },
            { toast:'你們已經三天沒有講到話了。', ms:3200 }
          ]
        },
        {
          label: '放回碗下面',
          cost: '歸屬感 +3',
          calm: +3,
          beats: [
            { who:'pc',  text:'你把錢壓回去，位置一模一樣。' },
            { who:'pc',  text:'晚上你回來，錢不見了，\n碗下面多了三百。' },
            { toast:'她以為你沒看到。', ms:3600 }
          ]
        }
      ]
    },

    /* ── 第 11 天 ── 你有話想講 ── */
    {
      day: 11,
      title: '她睡著了',
      beats: [
        { who:'pc',  text:'她在沙發上睡著了，電視還開著。' },
        { who:'pc',  text:'你今天有事想跟她講。' },
        { who:'pc',  text:'她明天六點要起床。' }
      ],
      menu: [
        {
          label: '叫醒她',
          cost: '歸屬感 −7',
          calm: -7,
          beats: [
            { who:'mom', text:'「⋯⋯嗯？怎麼了。」' },
            { who:'pc',  text:'她眼睛沒有完全張開，\n但她坐起來了。' },
            { who:'pc',  text:'你看著她的臉。' },
            { who:'pc',  text:'「⋯⋯沒事。你去床上睡。」' },
            { toast:'你把話吞回去了。你不是不敢講，你是捨不得。', ms:4200 }
          ]
        },
        {
          label: '幫她蓋被子',
          cost: '歸屬感 +3',
          calm: 3,
          beats: [
            { who:'mom', text:'「⋯⋯你回來啦。」' },
            { who:'pc',  text:'她眼睛沒張開。\n三秒之後又睡著了。' },
            { toast:'你把電視關掉，聲音留了一點點。', ms:3400 }
          ]
        }
      ]
    },

    /* ── 第 17 天 ── 那個「喔」 ── */
    {
      day: 17,
      title: '她問你學校',
      beats: [
        { who:'pc',  text:'她今天休假。這個月第一次。' },
        { who:'mom', text:'「學校還好嗎。」' }
      ],
      menu: [
        {
          label: '「還好。」',
          cost: '歸屬感 −5',
          calm: -5,
          beats: [
            { who:'mom', text:'「那就好。」' },
            { who:'pc',  text:'她點點頭，繼續摺衣服。' },
            { toast:'你已經兩個禮拜沒有去了。', ms:3400 }
          ]
        },
        {
          label: '說實話',
          cost: '歸屬感 −11',
          calm: -11,
          beats: [
            { who:'pc',  text:'「我最近⋯⋯比較少去。」' },
            { who:'pc',  text:'她摺衣服的手停了一下。' },
            { who:'mom', text:'「喔。」' },
            { who:'pc',  text:'她沒有罵你。' },
            { who:'pc',  text:'她只是很累。' },
            { toast:'那個「喔」比罵你還難受。', ms:4000 }
          ]
        }
      ]
    },

    /* ── 第 23 天 ── 她瘦了 ── */
    {
      day: 23,
      title: '制服變鬆了',
      beats: [
        { who:'pc',  text:'她在陽台晾衣服。' },
        { who:'pc',  text:'你發現她的制服變鬆了。\n\n那件制服你看了三年。' }
      ],
      menu: [
        {
          label: '「你有沒有吃飯。」',
          cost: '歸屬感 −6',
          calm: -6,
          beats: [
            { who:'mom', text:'「有啊。」' },
            { who:'pc',  text:'她答得很快。' },
            { who:'mom', text:'「早市那邊他們都會留菜給我。」' },
            { toast:'你沒有再問下去。', ms:3400 }
          ]
        },
        {
          label: '什麼都沒說',
          cost: '歸屬感 −8',
          calm: -8,
          beats: [
            { who:'pc',  text:'你回房間，把門帶上。' },
            { who:'pc',  text:'你坐在床邊算了一下\n自己這個月賺了多少。' },
            { toast:'不夠。差很多。', ms:3400 }
          ]
        }
      ]
    },

    /* ── 第 28 天 ── 到這裡就停,不要再補一句 ── */
    {
      day: 28,
      title: '皮包',
      beats: [
        { who:'pc',  text:'她睡著了。' },
        { who:'pc',  text:'她的皮包在桌上。' },
        { who:'pc',  text:'你這個月打工領了六千四。' }
      ],
      menu: [
        {
          label: '放三千進去',
          cost: '−$3000　歸屬感 +6',
          money: -3000, calm: +6,
          beats: [
            { who:'pc',  text:'你把錢夾在她的悠遊卡後面。\n那裡她不會馬上看到。' },
            { who:'pc',  text:'隔天她沒有提。' },
            { who:'pc',  text:'但那天晚上，碗下面\n有一張你最喜歡吃的滷味。' },
            { toast:'你們兩個都沒有說。', ms:4400 }
          ]
        },
        {
          label: '把皮包放回原位',
          cost: '歸屬感 −7',
          calm: -7,
          beats: [
            { who:'pc',  text:'你把皮包挪回原來的位置，\n角度也對好。' },
            { who:'pc',  text:'你這個月要繳的錢，\n跟她這個月少掉的體重，\n是同一件事。' },
            { toast:'你回房間，把燈關掉。', ms:4000 }
          ]
        }
      ]
    }
  ];

  root.StoryWork = { NODES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
