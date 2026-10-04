"""영수증 OCR 정확도 측정.

receipts/ 에 이미지와 expected.json 을 둔다:
  {"a.jpg": {"merchant_name": "스타벅스", "total_amount": 14500, "supply_value": 13182, "vat": 1318, "tax_free_amount": null}}
정답이 없는 이미지는 추출 결과만 출력한다 (정답 작성용).

  python eval_receipts.py [--llm] [receipts_dir]
"""
import asyncio
import json
import sys
import time
from pathlib import Path

import main

FIELDS = ["merchant_name", "total_amount", "supply_value", "vat", "tax_free_amount"]


def run(path: Path, use_llm: bool):
    lines, uncertain = main.run_paddle(path.read_bytes())
    if use_llm:
        return asyncio.run(main.build_receipt_with_llm(lines, uncertain))
    return main.build_receipt(lines)


def matches(field, got, want) -> bool:
    if field == "merchant_name":
        if not want:  # 영수증에 상호명이 없으면 빈 값이 정답
            return not got
        return want.replace(" ", "") in (got or "").replace(" ", "")
    return got == want


def evaluate(folder: Path, use_llm: bool) -> None:
    expected_path = folder / "expected.json"
    expected = json.loads(expected_path.read_text(encoding="utf-8-sig")) if expected_path.exists() else {}
    images = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    hits = {f: 0 for f in FIELDS}
    scored, times = 0, []
    for img in images:
        t = time.time()
        r = run(img, use_llm)
        times.append(time.time() - t)
        got = r.model_dump(include=set(FIELDS))
        want = expected.get(img.name)
        if want is None:
            print(f"{img.name} ({times[-1]:.1f}s, conf {r.confidence:.2f}) [정답 없음] {json.dumps(got, ensure_ascii=False)}")
            continue
        scored += 1
        miss = []
        for f in FIELDS:
            if matches(f, got[f], want.get(f)):
                hits[f] += 1
            else:
                miss.append(f"{f}: {got[f]!r} != {want.get(f)!r}")
        print(f"{img.name} ({times[-1]:.1f}s, conf {r.confidence:.2f}) " + ("OK" if not miss else "; ".join(miss)))

    if times:
        print(f"\n{len(images)}장, 평균 {sum(times) / len(times):.1f}s")
    if scored:
        for f in FIELDS:
            print(f"  {f:16s} {hits[f]}/{scored} ({100 * hits[f] / scored:.0f}%)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--llm"]
    evaluate(Path(args[0]) if args else Path(__file__).parent / "receipts", "--llm" in sys.argv)
