#!/usr/bin/env python3
"""no-way-up — 把 GPT 生的格狀組合圖裁成好幾張材質檔

一次跟 GPT 要好幾張材質太浪費(一張一次),所以改成生一張 N×M 的組合圖,
用這支切開存進 assets/tex/。裁的時候每一格再往內縮一點(--margin),
閃開 GPT 沒切乾淨的格線或接縫,不然邊緣會混進另一格的顏色。

用法:
  python3 tools/crop-grid.py combo.png --cols 2 --rows 2 \
    --names char-hoodie.png char-pants.png char-shoe.png sign-frame.png

--names 按橫著數的順序對齊:左上、右上、左下、右下……
"""
import argparse
import os
from PIL import Image


def main():
    p = argparse.ArgumentParser()
    p.add_argument('input')
    p.add_argument('--cols', type=int, required=True)
    p.add_argument('--rows', type=int, required=True)
    p.add_argument('--names', nargs='+', required=True)
    p.add_argument('--out', default='assets/tex')
    p.add_argument('--margin', type=float, default=0.04, help='每格再往內縮的比例')
    args = p.parse_args()

    if len(args.names) != args.cols * args.rows:
        raise SystemExit(f'--names 要給 {args.cols*args.rows} 個檔名,給了 {len(args.names)} 個')

    img = Image.open(args.input).convert('RGB')
    W, H = img.size
    cw, ch = W / args.cols, H / args.rows

    os.makedirs(args.out, exist_ok=True)
    i = 0
    for row in range(args.rows):
        for col in range(args.cols):
            x0, y0 = col * cw, row * ch
            mx, my = cw * args.margin, ch * args.margin
            box = (round(x0 + mx), round(y0 + my), round(x0 + cw - mx), round(y0 + ch - my))
            cell = img.crop(box)
            out_path = os.path.join(args.out, args.names[i])
            cell.save(out_path)
            print(f'{args.names[i]:20s} <- cell({row},{col})  {cell.size[0]}x{cell.size[1]}  {out_path}')
            i += 1


if __name__ == '__main__':
    main()
