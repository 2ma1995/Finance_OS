import os
import re
import logging
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import vision

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="OCR Server", version="5.0.0")

_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

vision_client = vision.ImageAnnotatorClient()


# ── 응답 모델 ──────────────────────────────────────────────────
class OCRRequest(BaseModel):
    image_url: str


class ReceiptData(BaseModel):
    merchant_name: str
    total_amount: int
    supply_value: int | None
    vat: int | None
    tax_free_amount: int | None
    ocr_failed: bool
    raw_text: str
    lines: list[str]


# ── Google Vision OCR ─────────────────────────────────────────
def run_vision_bytes(data: bytes) -> list[str]:
    image = vision.Image(content=data)
    response = vision_client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(response.error.message)
    full_text = response.full_text_annotation.text
    return [l.strip() for l in full_text.splitlines() if l.strip()]


def run_vision_url(image_url: str) -> list[str]:
    image = vision.Image(source=vision.ImageSource(image_uri=image_url))
    response = vision_client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(response.error.message)
    full_text = response.full_text_annotation.text
    return [l.strip() for l in full_text.splitlines() if l.strip()]


# ── 파싱 유틸 ─────────────────────────────────────────────────
def _to_int(s: str) -> int:
    return int(re.sub(r"[^0-9]", "", s) or "0")


def _normalize(s: str) -> str:
    s = re.sub(r"\s+", "", s)
    return re.sub(r"(\d)\.(\d{3})(?!\d)", r"\1\2", s)


def _extract_amount(line: str) -> int | None:
    norm = _normalize(line)
    matches = re.findall(r"[₩¥W]?([\d,]{3,})", norm)
    for m in reversed(matches):
        val = _to_int(m)
        if 100 <= val < 10_000_000:
            return val
    return None


def _is_noise_line(line: str) -> bool:
    return bool(
        re.search(r"\d{4}[-/]\d{2}[-/]\d{2}", line) or
        re.search(r"\d{2}:\d{2}", line) or
        re.search(r"\d{2,3}-\d{3,4}-\d{4}", line) or
        re.search(r"\d{3}-\d{2}-\d{5}", line) or
        re.search(r"#\d+", line) or
        re.search(r"\d{3,}[가-힣]", line) or
        len(re.sub(r"[^0-9]", "", line)) >= 10
    )


def _is_price_line(line: str) -> bool:
    t = line.strip()
    return bool(re.match(r'^[₩¥W\*]?\s*[\d,\.]+\s*원?$', t))


def _find_keyword_amount(
    lines: list[str],
    keywords: list[str],
    max_lookahead: int = 7,
    pick_last: bool = True,
    pick_max: bool = False,
) -> tuple[int | None, int]:
    clean = [_normalize(l) for l in lines]
    all_candidates: list[tuple[int, int]] = []

    for kw in keywords:
        kw_clean = _normalize(kw)
        for i, c in enumerate(clean):
            if kw_clean not in c:
                continue
            if _is_noise_line(lines[i]):
                continue
            val = _extract_amount(lines[i])
            if val:
                all_candidates.append((val, i))
                if not pick_max:
                    return val, i
                continue
            for j in range(i + 1, min(i + 1 + max_lookahead, len(lines))):
                if _is_noise_line(lines[j]):
                    continue
                v = _extract_amount(lines[j])
                if v:
                    all_candidates.append((v, j))
                    if not pick_max:
                        break

    if not all_candidates:
        return None, -1
    if pick_max:
        return max(all_candidates, key=lambda x: x[0])
    return all_candidates[-1] if pick_last else all_candidates[0]


def _find_currency_amount(lines: list[str]) -> tuple[int | None, int]:
    candidates = []
    for i, line in enumerate(lines):
        if _is_noise_line(line):
            continue
        norm = _normalize(line)
        m = re.search(r'[₩¥W]([\d,]{3,})', norm)
        if m:
            val = _to_int(m.group(1))
            if val >= 1000:
                candidates.append((val, i))
    if candidates:
        return max(candidates, key=lambda x: x[0])
    return None, -1


def _find_duplicate_amount(lines: list[str]) -> tuple[int | None, int]:
    counts: dict[int, list[int]] = {}
    for i, line in enumerate(lines):
        if _is_noise_line(line):
            continue
        v = _extract_amount(line)
        if v and v >= 1000:
            counts.setdefault(v, []).append(i)
    dupes = {v: idxs for v, idxs in counts.items() if len(idxs) >= 2}
    if dupes:
        best = max(dupes)
        return best, dupes[best][-1]
    return None, -1


# ── 상세 파싱 ─────────────────────────────────────────────────
def parse_detailed_amounts(lines: list[str]) -> dict:
    TOTAL_KW = [
        "합계", "합 계", "합겠", "합게",
        "받겠", "결제대상금액", "결제 대상금액",
        "결제금액", "청구금액", "총계", "총 계",
        "TOTAL", "AMOUNT",
    ]
    SUPPLY_KW = ["과세물품가액", "공급가액", "과세금액", "공 급 가 액"]
    VAT_KW = ["부가세", "부 가 세", "부가가치세", "VAT", "세액"]
    TAX_FREE_KW = ["면세물품가액", "면세금액", "비과세", "면 세"]

    supply, _ = _find_keyword_amount(lines, SUPPLY_KW, max_lookahead=2, pick_last=False)
    vat, _ = _find_keyword_amount(lines, VAT_KW, max_lookahead=2, pick_last=False)
    tax_free, _ = _find_keyword_amount(lines, TAX_FREE_KW, max_lookahead=2, pick_last=False)

    # 0단계: ₩/W 접두사 금액 → 최우선 합계 신호
    total, total_line = _find_currency_amount(lines)

    # 1단계: 중복 등장 최댓값
    if not total:
        total, total_line = _find_duplicate_amount(lines)

    # 2단계: 키워드 탐색 (pick_max)
    if not total:
        total, total_line = _find_keyword_amount(lines, TOTAL_KW, max_lookahead=7, pick_max=True)

    # 3단계: supply+vat 교차검증 — total 없을 때만
    if supply and vat and not total:
        computed = supply + vat + (tax_free or 0)
        for i, line in enumerate(lines):
            v = _extract_amount(line)
            if v and abs(v - computed) <= 10:
                total, total_line = computed, i
                break

    # 4단계: supply/vat 검증 및 재계산
    if total:
        taxable = total - (tax_free or 0)
        if supply and vat:
            computed = supply + vat + (tax_free or 0)
            if abs(computed - total) > 10 and abs((supply + vat) - total) > 10:
                vat = round(taxable / 11)
                supply = taxable - vat
        else:
            if not vat:
                vat = round(taxable / 11)
            if not supply:
                supply = taxable - vat

    # 5단계: fallback — 가격처럼 생긴 줄 중 최댓값
    if not total:
        candidates = []
        for i, line in enumerate(lines):
            if _is_noise_line(line) or not _is_price_line(line):
                continue
            v = _extract_amount(line)
            if v and v >= 1000:
                candidates.append((v, i))
        if candidates:
            total, total_line = max(candidates, key=lambda x: x[0])

    return {
        "total_amount": total or 0,
        "supply_value": supply,
        "vat": vat,
        "tax_free_amount": tax_free,
        "total_line": total_line,
    }


def parse_merchant(lines: list[str]) -> str:
    KEYWORDS = ["가맹점명", "가맹점", "상호명", "상호", "점포명", "점포"]
    for i, line in enumerate(lines):
        for kw in KEYWORDS:
            if kw in line:
                after = re.split(r"[:：]\s*", line, maxsplit=1)[-1].strip()
                if 2 <= len(after) <= 40:
                    return after
                if i + 1 < len(lines):
                    nxt = lines[i + 1].strip()
                    if 2 <= len(nxt) <= 40 and not nxt[0].isdigit():
                        return nxt

    SKIP = re.compile(
        r"고객용|단말기|전표|IC신용|승인|거래일|카드번|일시불|현금|자진발급|"
        r"판매|구매|영수|receipt|www\.|\.co\.|tel|전화|팩스|fax|"
        r"주소|주\s*소|사업자|대표|등록번호|편의점|마트|"
        r"^\d{4}[-/]|^\d{2}:\d{2}|^\d+$|^[#\-=*_\[\]()（）\s]+$",
        re.IGNORECASE,
    )
    LOGO = re.compile(r"^[A-Z\s&*\-\.]{1,6}$")
    CORP = re.compile(r"^\(주\)|\(유\)|\(사\)|\(재\)", re.IGNORECASE)

    for line in lines[:15]:
        t = line.strip()
        if len(t) < 2 or len(t) > 40:
            continue
        if SKIP.search(t) or LOGO.match(t):
            continue
        cleaned = CORP.sub("", t).strip()
        if len(cleaned) >= 2:
            return cleaned

    return ""


def build_receipt(lines: list[str]) -> ReceiptData:
    amounts = parse_detailed_amounts(lines)
    merchant = parse_merchant(lines)
    return ReceiptData(
        merchant_name=merchant,
        total_amount=amounts["total_amount"],
        supply_value=amounts["supply_value"],
        vat=amounts["vat"],
        tax_free_amount=amounts["tax_free_amount"],
        ocr_failed=amounts["total_amount"] == 0,
        raw_text="\n".join(lines),
        lines=lines,
    )


# ── 엔드포인트 ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr", response_model=ReceiptData)
async def run_ocr(req: OCRRequest):
    logger.info(f"OCR 요청: {req.image_url[:80]}...")
    try:
        # Vision API가 직접 URL 접근 가능하면 바로 사용, 아니면 다운로드 후 처리
        try:
            lines = run_vision_url(req.image_url)
        except Exception:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(req.image_url)
                resp.raise_for_status()
            lines = run_vision_bytes(resp.content)
        logger.info(f"추출 완료: {len(lines)}줄")
        return build_receipt(lines)
    except Exception as e:
        logger.error(f"OCR 처리 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 처리 오류: {e}")


@app.post("/ocr-file", response_model=ReceiptData)
async def run_ocr_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        lines = run_vision_bytes(content)
        logger.info(f"파일 OCR 완료: {len(lines)}줄")
        return build_receipt(lines)
    except Exception as e:
        logger.error(f"OCR 처리 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 처리 오류: {e}")
