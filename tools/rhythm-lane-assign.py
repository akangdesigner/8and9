#!/usr/bin/env python3
"""no-way-up — 陣頭音遊譜面產生器(2026-08-31)

從一首歌自動抓拍點(spectral flux 抓能量高峰),挑密度最高的一段當遊玩
片段,再把每個拍點指派到 up/down/left/right/space 五個判定鍵(space 是
「大鼓」重拍,每 5~7 個音符出現一次),偶爾挑一個間隔夠大的音符改成拉長音
(hold>0,要按住到 t+hold 才算過)。輸出可以直接貼進
prototypes/lib/rhythm-troupe.js 的 SONGS.<key>.chart。

⚠ 這是程式自動抓的,不是真的手動聽歌打譜(見 rhythm-troupe.js 檔頭筆記),
節奏感不對時先調這裡的參數(--min-gap、--clip-len、--seed),而不是去
rhythm-troupe.js 裡手改陣列——那樣下次重跑這支腳本又會被蓋掉。

用法:
  python3 tools/rhythm-lane-assign.py <mp3路徑> [--clip-len 20] [--seed 1]

需要 ffmpeg 在 PATH 上(用來把 mp3 解成 PCM 分析),不需要額外裝 librosa。
"""
import argparse, subprocess, random
import numpy as np


def load_pcm(path, sr=22050):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32), sr


def onset_times(path, min_gap=0.18, sr=22050, n_fft=2048, hop=512):
    y, sr = load_pcm(path, sr)
    n_frames = 1 + (len(y) - n_fft) // hop
    win = np.hanning(n_fft)
    prev_mag = None
    flux = np.zeros(n_frames)
    for i in range(n_frames):
        frame = y[i*hop: i*hop+n_fft] * win
        mag = np.abs(np.fft.rfft(frame))
        if prev_mag is not None:
            diff = mag - prev_mag
            diff[diff < 0] = 0
            flux[i] = diff.sum()
        prev_mag = mag
    win_frames = int(1.5 * sr / hop)
    padded = np.pad(flux, (win_frames, win_frames), mode='edge')
    thresh = np.array([padded[i:i+2*win_frames+1].mean() for i in range(n_frames)])
    thresh = thresh * 1.5 + flux.std() * 0.3
    times = np.arange(n_frames) * hop / sr
    picks, last_t = [], -999
    for i in range(1, n_frames-1):
        if flux[i] > thresh[i] and flux[i] >= flux[i-1] and flux[i] >= flux[i+1]:
            t = times[i]
            if t - last_t >= min_gap:
                picks.append(round(float(t), 3))
                last_t = t
    return picks, len(y)/sr


def best_window(notes, dur, length, margin=8):
    lo, hi = margin, dur - margin - length
    best_t, best_n, t = lo, -1, lo
    while t <= hi:
        cnt = sum(1 for n in notes if t <= n < t+length)
        if cnt > best_n:
            best_n, best_t = cnt, t
        t += 1.0
    return best_t


def build_chart(times, seed, target_hold_frac=0.1):
    rnd = random.Random(seed)
    lanes = ['up', 'right', 'down', 'left']
    n = len(times)
    target_holds = max(1, round(n * target_hold_frac))
    gaps = sorted(((times[i+1]-times[i], i) for i in range(n-1)), key=lambda x: -x[0])
    hold_idx, last_picked = set(), -10
    for gap, i in gaps:
        if len(hold_idx) >= target_holds:
            break
        if gap < 0.32 or i - last_picked < 4:
            continue
        hold_idx.add(i)
        last_picked = i

    out, prev_lane, since_space = [], None, 0
    for i, t in enumerate(times):
        since_space += 1
        if since_space >= rnd.randint(5, 7):
            lane, since_space = 'space', 0
        else:
            lane = rnd.choice([l for l in lanes if l != prev_lane])
        prev_lane = lane if lane != 'space' else prev_lane
        hold = round(min(0.5, (times[i+1]-t)*0.7), 2) if i in hold_idx else 0
        out.append({'t': round(t, 3), 'lane': lane, 'hold': hold})
    return out


def fmt_chart(chart):
    return '[' + ','.join(
        "{t:%s,lane:'%s',hold:%s}" % (n['t'], n['lane'], n['hold']) for n in chart
    ) + ']'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mp3')
    ap.add_argument('--clip-len', type=float, default=20)
    ap.add_argument('--min-gap', type=float, default=0.18)
    ap.add_argument('--seed', type=int, default=1)
    args = ap.parse_args()

    notes, dur = onset_times(args.mp3, min_gap=args.min_gap)
    clip_start = best_window(notes, dur, args.clip_len)
    clip_notes = [round(n - clip_start, 3) for n in notes if clip_start <= n < clip_start+args.clip_len]
    chart = build_chart(clip_notes, seed=args.seed)

    print('clipStart:', round(clip_start, 2), ' clipLen:', args.clip_len, ' notes:', len(chart))
    print('chart:', fmt_chart(chart))
