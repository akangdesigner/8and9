/* no-way-up — 機車行老闆・旺鴻
 *
 * 純資料,不碰 DOM。跟 npc-temple.js 的攤販(阿姨/阿成)同一套消費方式——
 * game.html 的 talkToStallVendor(state, 這份資料, ...) 直接吃 talk[]/events[]。
 *
 * 2026-08-25 kc:「老闆是善的代表,風評 10 以上打折,以前在陣頭混過、後來
 *   變成犯罪份子,金盆洗手開一家樸素的機車行,廟口的人跟他會有互動。」
 *   完整設計討論見 docs/DESIGN_NOTES.md「機車行老闆・旺鴻」。
 *
 * 基準線照 CLAUDE.md:他的過去不是拿來獵奇的「壞人洗白」爽點,是跟主角
 * 現在站的位置同一條路的另一段——他走出來了,但走出來之後也還在苦撐
 * (房租/削價競爭),不是「金盆洗手就從此幸福」的勵志樣板。
 */
(function (root) {

  const talk = [
    '「車有什麼問題,牽來就對了。」',
    '他蹲在地上調一台車的鏈條,頭也沒抬。「等我一下。」',
    '「這附近開的店,倒得差不多了。」他說得很平淡,像在講別人的事。',
    '「你不用裝熟,我不吃這套。」他笑了一下。「但你缺什麼,講。」'
  ];

  const events = [
    { at:2, title:'他自己修車',
      beats:[
        { who:'pc',      text:'店裡沒有別人,他自己一個人顧。' },
        { who:'motoboss', text:'「這台是我自己留的。」他拍了拍旁邊那台舊車。' },
        { who:'motoboss', text:'「別家早就換新的了,我這台騎十幾年,壞哪修哪。」' },
        { who:'pc',      text:'他講這句話的時候,手上的動作沒有停。' }
      ],
      quiet:'他的店很樸素,沒有招牌燈、沒有促銷布條,只有一排排整整齊齊的車。', calm:+6 },
    { at:4, title:'他以前的事',
      beats:[
        { who:'motoboss', text:'「你知道我以前是幹嘛的嗎。」他難得主動開口。' },
        { who:'motoboss', text:'「陣頭出身,跟你認識的那些人差不多。」' },
        { who:'motoboss', text:'「後來走歪了,做過一些不能講的事。」' },
        { who:'pc',      text:'他沒有解釋是什麼事,你也沒有問。' },
        { who:'motoboss', text:'「金盆洗手,說得好聽而已——其實就是有一天,我不想再過那種日子了。」' }
      ],
      quiet:'他說完就低頭繼續修車,好像剛剛那句話是講給空氣聽的。', calm:+10 },
    { at:6, title:'他為什麼看人品',
      beats:[
        { who:'pc',      text:'你問他,店裡東西賣這麼便宜,不怕虧嗎。' },
        { who:'motoboss', text:'「我不是在做善事。」他頭也沒抬。' },
        { who:'motoboss', text:'「我只是知道,被人逼到牆角是什麼感覺——那時候誰都不理我。」' },
        { who:'motoboss', text:'「所以我不看你穿什麼、騎什麼,我看你這個人怎麼樣。」' },
        { who:'pc',      text:'他抬起頭看了你一眼,像是在打量。' }
      ],
      quiet:'這條街上,願意這樣講的人不多。', calm:+12 }
  ];

  root.StoryMotoBoss = { talk, events };
})(typeof globalThis !== 'undefined' ? globalThis : this);
