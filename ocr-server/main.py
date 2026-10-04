import os
import re
import json
import logging
import threading
import cv2
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from paddleocr import PaddleOCR
from starlette.concurrency import run_in_threadpool

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

# lang="korean" → PP-OCRv5_server_det + korean_PP-OCRv5_mobile_rec (v6는 한국어 미지원)
ocr_engine = PaddleOCR(
    lang="korean",
    use_doc_orientation_classify=True,
    use_doc_unwarping=False,
    use_textline_orientation=True,
    text_det_limit_side_len=1920,
    text_det_limit_type="max",
)
# ponytail: 전역 락으로 한 번에 한 장씩 처리, 동시 요청 많아지면 워커 프로세스로 분리
_ocr_lock = threading.Lock()
LOW_SCORE = 0.8

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")
CONFIDENCE_THRESHOLD = 0.7


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
    confidence: float


# ── 전처리 ───────────────────────────────────────────────────
def _crop_receipt(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.3 * img.shape[0] * img.shape[1]:
        return img
    quad = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
    if len(quad) != 4:
        return img
    pts = quad.reshape(4, 2).astype(np.float32)
    s, d = pts.sum(axis=1), np.diff(pts, axis=1).ravel()
    tl, br, tr, bl = pts[s.argmin()], pts[s.argmax()], pts[d.argmin()], pts[d.argmax()]
    w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    m = cv2.getPerspectiveTransform(
        np.array([tl, tr, br, bl]), np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    )
    return cv2.warpPerspective(img, m, (w, h))


def preprocess(img: np.ndarray) -> np.ndarray:
    img = _crop_receipt(img)
    long_side = max(img.shape[:2])
    if long_side < 1000:
        scale = 1000 / long_side
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


# ── PaddleOCR ─────────────────────────────────────────────────
def group_lines(texts: list[str], polys, scores: list[float]) -> tuple[list[str], list[str]]:
    """박스를 y좌표로 묶어 한 줄 텍스트로 재구성. (lines, 저신뢰 토큰) 반환."""
    boxes = []
    for t, p, sc in zip(texts, polys, scores):
        p = np.asarray(p)
        ys, xs = p[:, 1], p[:, 0]
        boxes.append((ys.mean(), ys.max() - ys.min(), xs.min(), t, sc))
    if not boxes:
        return [], []
    tol = 0.5 * float(np.median([b[1] for b in boxes]))
    rows: list[list] = []
    for b in sorted(boxes, key=lambda b: b[0]):
        if rows and abs(b[0] - rows[-1][-1][0]) <= tol:
            rows[-1].append(b)
        else:
            rows.append([b])
    lines = [" ".join(b[3] for b in sorted(r, key=lambda b: b[2])).strip() for r in rows]
    uncertain = [b[3] for b in boxes if b[4] < LOW_SCORE]
    return [l for l in lines if l], uncertain


def run_paddle(data: bytes) -> tuple[list[str], list[str]]:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("이미지를 읽을 수 없습니다")
    with _ocr_lock:
        res = ocr_engine.predict(preprocess(img))[0]
    return group_lines(res["rec_texts"], res["rec_polys"], res["rec_scores"])


# ── 파싱 유틸 ─────────────────────────────────────────────────
def _to_int(s: str) -> int:
    return int(re.sub(r"[^0-9]", "", s) or "0")


def _normalize(s: str) -> str:
    s = re.sub(r"\s+", "", s)
    # 금액 속 OCR 혼동 교정 (단어 끝 글자는 건드리지 않음: "Oil 1,000" 보호)
    s = re.sub(r"(?<=[\d,])[Oo]+(?![A-Za-z])|(?<![A-Za-z])[Oo]+(?=[\d,]*\d)", lambda m: "0" * len(m[0]), s)
    s = re.sub(r"(?<=[\d,])[lI|]+(?![A-Za-z])|(?<![A-Za-z])[lI|]+(?=[\d,]*\d)", lambda m: "1" * len(m[0]), s)
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
    # "부가세 과세물품가액 5,001" 같은 공급가액 줄이 부가세로 잡히지 않도록 제외
    supply_norm = [_normalize(k) for k in SUPPLY_KW]
    vat_lines = ["" if any(k in _normalize(l) for k in supply_norm) else l for l in lines]
    vat, _ = _find_keyword_amount(vat_lines, VAT_KW, max_lookahead=2, pick_last=False)
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

    # 재계산 전에 기록: 텍스트에서 찾은 공급가액+부가세가 합계와 맞는지
    verified = bool(total and supply and vat) and min(
        abs(supply + vat + (tax_free or 0) - total), abs(supply + vat - total)
    ) <= 10

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
    total_fallback = not total
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
        "verified": verified,
        "total_fallback": total_fallback,
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
        r"상품명|단가|수량|합계|부가세|과세|면세|금액|결제|카드|"
        r"[가-힣]+[구군]\s*[가-힣\d]+(로|길)|^\d+층$|\d{1,3}(,\d{3})+|\s\d{3,}$|^\[|"
        r"^\d{4}[-/]|^\d{2}:\d{2}|^\d+$|^[#\-=*_\[\]()（）\s]+$",
        re.IGNORECASE,
    )
    LOGO = re.compile(r"^[A-Z\s&*\-\.]{1,6}$")
    CORP = re.compile(r"^\(주\)|\(유\)|\(사\)|\(재\)", re.IGNORECASE)
    BRANCH = re.compile(r"^[가-힣A-Za-z0-9&\s]{1,20}(점|지점|본점)$")

    def skipped(t: str) -> bool:  # "부 가 세"처럼 띄어 쓴 줄도 잡도록 공백 제거본도 검사
        return bool(SKIP.search(t) or SKIP.search(t.replace(" ", "")))

    for line in lines[:15]:
        t = line.strip()
        if BRANCH.match(t) and not skipped(t):
            return t

    for line in lines[:15]:
        t = line.strip()
        if len(t) < 2 or len(t) > 40:
            continue
        if skipped(t) or LOGO.match(t):
            continue
        cleaned = CORP.sub("", t).strip()
        # 한글 또는 영문자가 없으면 상호명으로 사용 불가 (숫자/기호만 있는 줄 제외)
        if len(cleaned) >= 2 and re.search(r'[가-힣a-zA-Z]', cleaned):
            return cleaned

    return ""


def compute_confidence(amounts: dict, merchant: str) -> float:
    if not amounts["total_amount"]:
        return 0.0
    score = 1.0
    if amounts["total_fallback"]:
        score -= 0.4
    if not amounts["verified"]:
        score -= 0.35
    if not merchant:
        score -= 0.2
    return round(max(score, 0.0), 2)


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
        confidence=compute_confidence(amounts, merchant),
    )


# ── Ollama 검증 (신뢰도 낮은 케이스만) ──────────────────────────
_INT_OR_NULL = {"type": ["integer", "null"]}
LLM_SCHEMA = {
    "type": "object",
    "properties": {
        "merchant_name": {"type": "string"},
        "total_amount": {"type": "integer"},
        "supply_value": _INT_OR_NULL,
        "vat": _INT_OR_NULL,
        "tax_free_amount": _INT_OR_NULL,
    },
    "required": ["merchant_name", "total_amount", "supply_value", "vat", "tax_free_amount"],
}

LLM_PROMPT = """영수증 OCR 텍스트에서 상호명, 합계금액, 공급가액, 부가세, 면세금액을 추출하세요.
OCR 오인식이 있을 수 있습니다 (예: O→0, l→1, B→8, 합계→힙게). 금액은 원 단위 정수입니다.
영수증에 없는 값은 null로 두세요.

[예시 1]
이디야커피 역삼점
카페모카 4,8OO
홀케이크 18,2OO
공급가액 2O,9O9
부가서 2,O91
힙게 23,OOO
→ {{"merchant_name": "이디야커피 역삼점", "total_amount": 23000, "supply_value": 20909, "vat": 2091, "tax_free_amount": null}}

[예시 2]
GS25 선릉점
삼각김밥 1,5OO
생수 95O
합 계 2,45O
→ {{"merchant_name": "GS25 선릉점", "total_amount": 2450, "supply_value": null, "vat": null, "tax_free_amount": null}}
{hint}
[영수증]
{text}
→"""


def _num(v) -> int | None:
    return None if v in (None, "") else _to_int(str(v))


def _amounts_in_text(lines: list[str]) -> set[int]:
    return {_to_int(m) for l in lines for m in re.findall(r"\d[\d,]*", _normalize(l))}


def merge_llm(receipt: ReceiptData, data: dict) -> ReceiptData:
    """LLM 값은 규칙 검증을 통과할 때만 채택. 실패하면 정규식 결과 유지."""
    in_text = _amounts_in_text(receipt.lines)
    total = receipt.total_amount
    llm_total = _num(data.get("total_amount"))
    if llm_total and llm_total in in_text:
        total = llm_total

    supply, vat, tax_free = receipt.supply_value, receipt.vat, receipt.tax_free_amount
    l_supply, l_vat, l_free = (_num(data.get(k)) for k in ("supply_value", "vat", "tax_free_amount"))
    if (
        l_supply in in_text and l_vat in in_text and (not l_free or l_free in in_text)
        and abs(l_supply + l_vat + (l_free or 0) - total) <= 10
    ):
        supply, vat, tax_free = l_supply, l_vat, l_free
    elif total != receipt.total_amount:
        # 합계가 바뀌었는데 LLM 세금값이 안 맞으면 새 합계 기준으로 재계산
        taxable = total - (tax_free or 0)
        vat = round(taxable / 11)
        supply = taxable - vat

    return receipt.model_copy(update={
        "merchant_name": receipt.merchant_name or (data.get("merchant_name") or "").strip(),
        "total_amount": total,
        "supply_value": supply,
        "vat": vat,
        "tax_free_amount": tax_free,
        "ocr_failed": total == 0,
    })


async def verify_with_ollama(receipt: ReceiptData, uncertain: list[str]) -> ReceiptData:
    hint = f"\n인식이 불확실한 글자: {', '.join(uncertain)}\n" if uncertain else ""
    prompt = LLM_PROMPT.format(hint=hint, text=receipt.raw_text)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "format": LLM_SCHEMA,
                    "stream": False,
                    "think": False,  # qwen3 사고 모드 끄기 (지연 방지)
                    "options": {"temperature": 0},
                },
            )
            resp.raise_for_status()
            data = json.loads(resp.json()["response"])
    except Exception as e:
        logger.warning(f"Ollama 검증 스킵 (사용 불가): {e}")
        return receipt

    merged = merge_llm(receipt, data)
    logger.info(f"LLM 제안 {data} → 채택 결과 total={merged.total_amount} vat={merged.vat}")
    return merged


async def build_receipt_with_llm(lines: list[str], uncertain: list[str]) -> ReceiptData:
    receipt = build_receipt(lines)
    if receipt.confidence < CONFIDENCE_THRESHOLD:
        logger.info(f"신뢰도 낮음 ({receipt.confidence:.2f}) → Ollama 검증 시도")
        receipt = await verify_with_ollama(receipt, uncertain)
    return receipt


# ── 엔드포인트 ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr", response_model=ReceiptData)
async def run_ocr(req: OCRRequest):
    logger.info(f"OCR 요청: {req.image_url[:80]}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(req.image_url)
            resp.raise_for_status()
        lines, uncertain = await run_in_threadpool(run_paddle, resp.content)
        logger.info(f"추출 완료: {len(lines)}줄, 저신뢰 {len(uncertain)}개")
        return await build_receipt_with_llm(lines, uncertain)
    except Exception as e:
        logger.error(f"OCR 처리 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 처리 오류: {e}")


@app.post("/ocr-file", response_model=ReceiptData)
async def run_ocr_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        lines, uncertain = await run_in_threadpool(run_paddle, content)
        logger.info(f"파일 OCR 완료: {len(lines)}줄, 저신뢰 {len(uncertain)}개")
        return await build_receipt_with_llm(lines, uncertain)
    except Exception as e:
        logger.error(f"OCR 처리 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 처리 오류: {e}")
