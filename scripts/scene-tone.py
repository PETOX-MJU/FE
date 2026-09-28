#!/usr/bin/env python3
"""
상점 테마 배경(shop/*/bg_*.jpg)의 윗부분 밝기를 재서, 어두운 배경 목록을
src/data/sceneTone.generated.ts 로 만든다. 마이페이지처럼 배경 위에 글자·아이콘을 올리는
화면이 이 목록을 보고 글자색을 자동으로 흰색으로 바꾼다.

배경 그림을 새로 넣거나 바꾸면 한 번 다시 돌린다:  python3 scripts/scene-tone.py
(Pillow 필요: pip install pillow)
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMAGES = os.path.join(ROOT, 'src', 'assets', 'images')
OUT = os.path.join(ROOT, 'src', 'data', 'sceneTone.generated.ts')
# 헤더가 올라가는 윗부분(세로 30%)의 평균 밝기(0~255)가 이보다 낮으면 어두운 배경
TOP_RATIO = 0.3
DARK_BELOW = 100

dark = []
for path in sorted(glob.glob(os.path.join(IMAGES, 'shop', '*', 'bg_*.jpg'))):
    im = Image.open(path).convert('L')
    w, h = im.size
    top = im.crop((0, 0, w, int(h * TOP_RATIO))).resize((50, 20))
    px = list(top.tobytes())
    mean = sum(px) / len(px)
    rel = os.path.relpath(path, os.path.join(ROOT, 'src', 'data')).replace(os.sep, '/')
    print(f'{mean:6.1f}  {"어두움" if mean < DARK_BELOW else "밝음 "}  {rel}')
    if mean < DARK_BELOW:
        dark.append(rel)

lines = [
    '// 자동 생성 파일 — 직접 고치지 말고 `python3 scripts/scene-tone.py` 로 다시 만든다.',
    '// 윗부분이 어두운 테마 배경들. 이 배경 위의 헤더 글자·아이콘은 흰색으로 그린다.',
    "import type { ImageSourcePropType } from 'react-native';",
    '',
    'export const DARK_SCENES: ReadonlySet<ImageSourcePropType> = new Set([',
    *[f"  require('{p}'),"for p in dark],
    ']);',
    '',
]
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'→ {os.path.relpath(OUT, ROOT)} ({len(dark)}개)')
