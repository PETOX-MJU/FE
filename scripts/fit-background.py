#!/usr/bin/env python3
"""배경 그림을 폰 화면 비율(20:9)에 맞춘다.

design/ 에서 받은 그림(1030 × 1830, 비율 0.563)은 요즘 폰 화면(0.45)보다 옆으로 넓어서
그대로 쓰면 오른쪽이 20% 잘린다. 그림 위쪽은 하늘이나 벽이라 무늬가 없으니, 그 부분을
위로 이어 붙여 캔버스를 세로로 키우면 그림 내용은 그대로 두고 화면에 딱 맞출 수 있다.

이어 붙이는 방법은 두 가지다.
- 벽지처럼 결이 있는 그림: 민무늬 구간을 통째로 복사해 반복한다(위아래로 번갈아 뒤집어
  붙여서 이음매가 안 생긴다). 한 줄만 늘이면 결이 세로로 번져 보인다.
- 구름이 낀 하늘처럼 민무늬 구간이 없는 그림: 위쪽을 위아래로 뒤집어 얹는다. 이음매가
  생기지 않고 구름 위에 구름이 오는 하늘이 된다.

위쪽까지 구름·나무가 꽉 찬 그림(캠핑)은 어떻게 이어 붙여도 해나 구름이 복제돼 보인다.
그런 그림은 --crop 으로 처리한다. 그림을 키워 높이를 맞추고 좌우를 10%씩 잘라낸다.
없던 부분을 지어내지 않아 가장 자연스럽지만 양옆이 조금 사라진다.

  python3 scripts/fit-background.py <원본> <저장할 곳> [--flip] [--crop] [--quality 92]

--flip 은 좌우 반전 (해가 오른쪽 위 버튼과 겹치지 않게 할 때).
"""
import sys

import numpy as np
from PIL import Image

TARGET_ASPECT = 0.45  # 1080 × 2400 = 20:9
FLAT_STD = 6.0  # 이 정도 아래면 '민무늬'로 본다
FLAT_DRIFT = 4.0  # 맨 윗줄 평균색에서 이만큼까지는 같은 면으로 본다
MIN_TILE = 24  # 반복에 쓸 최소 높이


def flat_top_height(arr: np.ndarray) -> int:
    """위에서부터 무늬·물체 없이 이어지는 높이(px)."""
    first = arr[0].mean(axis=0)
    for y in range(arr.shape[0]):
        row = arr[y]
        if row.std(axis=0).mean() > FLAT_STD:
            return y
        if np.abs(row.mean(axis=0) - first).max() > FLAT_DRIFT:
            return y
    return arr.shape[0]


def extend_top(im: Image.Image, add: int) -> Image.Image:
    """위쪽 민무늬 구간을 반복해 add 픽셀만큼 늘린 그림."""
    w, h = im.size
    flat = flat_top_height(np.asarray(im, dtype=float))
    out = Image.new('RGB', (w, h + add))
    out.paste(im, (0, add))

    if flat < MIN_TILE:
        # 민무늬 구간이 없는 그림(구름 낀 하늘 등)은 위쪽을 위아래로 뒤집어 얹는다.
        # 맨 윗줄을 늘이면 구름이 세로 줄무늬로 번진다.
        band = min(add, h)
        mirror = im.crop((0, 0, w, band)).transpose(Image.FLIP_TOP_BOTTOM)
        y = add - band
        out.paste(mirror, (0, max(y, 0)))
        if y > 0:  # 그래도 모자라면 그 위는 맨 윗줄 색으로 채운다
            out.paste(mirror.crop((0, 0, w, 1)).resize((w, y), Image.NEAREST), (0, 0))
        return out, 0

    tile = im.crop((0, 0, w, flat))
    flipped = tile.transpose(Image.FLIP_TOP_BOTTOM)
    # 아래에서 위로, 원본 → 뒤집은 것 → 원본 … 순서로 쌓아 이음매를 없앤다
    y = add
    i = 0
    while y > 0:
        piece = tile if i % 2 == 0 else flipped
        y -= flat
        # 맨 위로 넘어가면 PIL 이 알아서 잘라 붙인다 (직접 자르면 틈이 생긴다)
        out.paste(piece, (0, y))
        i += 1
    return out, flat


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flip = '--flip' in sys.argv
    quality = 92
    if '--quality' in sys.argv:
        quality = int(sys.argv[sys.argv.index('--quality') + 1])
    if len(args) != 2:
        print(__doc__)
        raise SystemExit(1)
    src_path, out_path = args

    im = Image.open(src_path).convert('RGB')
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = im.size

    target_h = round(w / TARGET_ASPECT)
    flat = 0
    how = ''
    if '--crop' in sys.argv:
        # 키워서 높이를 맞추고 좌우를 가운데 기준으로 잘라낸다
        big_w = round(w * target_h / h)
        big = im.resize((big_w, target_h), Image.LANCZOS)
        cut = (big_w - w) // 2
        im = big.crop((cut, 0, cut + w, target_h))
        how = f'키워서 좌우 각 {cut}px 잘라냄'
    elif target_h > h:
        im, flat = extend_top(im, target_h - h)
        how = f'위에 {target_h - h}px, 민무늬 {flat}px 반복'

    if out_path.lower().endswith(('.jpg', '.jpeg')):
        # 픽셀 경계가 뭉개지지 않게 크로마 서브샘플링을 끈다
        im.save(out_path, 'JPEG', quality=quality, subsampling=0, optimize=True)
    else:
        im.save(out_path)
    print(
        f'{src_path} -> {out_path}  {w} × {h} → {im.size[0]} × {im.size[1]} '
        f'({how}{", 좌우반전" if flip else ""})'
    )


if __name__ == '__main__':
    main()
