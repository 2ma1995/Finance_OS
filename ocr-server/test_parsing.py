"""파싱/신뢰도/LLM 폴백 검사 (Paddle 모델 로드 없이): python test_parsing.py"""
import asyncio
import os
import sys
import types

sys.modules["paddleocr"] = types.SimpleNamespace(PaddleOCR=lambda **_: None)
os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"  # 닫힌 포트 → Ollama 없음 상황

import main  # noqa: E402

full = ["스타벅스 강남역점", "아메리카노 4,500", "공급가액 13,182", "부가세 1,318", "합계 14,500"]
r = main.build_receipt(full)
assert (r.total_amount, r.supply_value, r.vat, r.confidence) == (14500, 13182, 1318, 1.0), r

# 공급가액/부가세가 텍스트에 없음 → 계산으로 채우되 신뢰도는 낮아야 함
r = main.build_receipt(["스타벅스 강남역점", "합계 14,500"])
assert r.total_amount == 14500 and r.vat == 1318 and r.confidence < main.CONFIDENCE_THRESHOLD, r

# 공급가액+부가세가 합계와 불일치
r = main.build_receipt(["스타벅스", "공급가액 10,000", "부가세 1,000", "합계 14,500"])
assert r.confidence < main.CONFIDENCE_THRESHOLD, r

# OCR 혼동 교정
assert main.build_receipt(["가게", "공급가액 13,l82", "부가세 1,3l8", "합계 14,5OO"]).total_amount == 14500

# "부가세 과세물품가액" 줄은 공급가액이지 부가세가 아님
r = main.build_receipt(["[영수증]", "합계 금액 5,500", "부가세 과세물품가액 5,001", "부 가 세 499"])
assert (r.supply_value, r.vat, r.confidence >= main.CONFIDENCE_THRESHOLD) == (5001, 499, True), r

# 상호명: 주소/층/표머리/품목줄은 제외, 상호명 없으면 빈 값
r = main.build_receipt(["[영수증]", "서울 강남구 테헤란로 123 (역삼동)", "3층", "상품명 단가 수량 금액",
                        "에스프레소 2,500 1 2,500", "합계 2,500", "부 가 세 227", "현 금 2,500"])
assert r.merchant_name == "", r

# 상호명: 안내문보다 "~점" 줄 우선
r = main.build_receipt(["[진동벨번호:0]", "주문하신 메뉴가 준비되면 해당", "강남역점", "경기도 성남시 수정구 어느로 1", "합계 7,500"])
assert r.merchant_name == "강남역점", r

# 합계 못 찾음
assert main.build_receipt(["가게", "감사합니다"]).confidence == 0.0

# 줄 재구성: 같은 높이의 박스는 한 줄로, x 순서대로
lines, unc = main.group_lines(
    ["14,500", "합계", "부가세", "1,318"],
    [[[300, 102], [360, 102], [360, 122], [300, 122]], [[10, 100], [60, 100], [60, 120], [10, 120]],
     [[10, 60], [60, 60], [60, 80], [10, 80]], [[300, 61], [360, 61], [360, 81], [300, 81]]],
    [0.99, 0.95, 0.97, 0.5],
)
assert lines == ["부가세 1,318", "합계 14,500"] and unc == ["1,318"], (lines, unc)

# LLM 병합: 텍스트에 없는 금액(환각)은 버림, 상호명은 정규식 우선
r = main.build_receipt(["스타벽스 강남역점", "공급가액 13,182", "부가세 1,31B", "힙게 14,500"])
m = main.merge_llm(r, {"merchant_name": "스타벽스", "total_amount": 14500, "supply_value": 13182,
                       "vat": 1310000000, "tax_free_amount": None})
assert (m.merchant_name, m.total_amount, m.supply_value, m.vat) == ("스타벽스 강남역점", 14500, 13182, 1318), m

# LLM이 세금 null → 정규식 계산값 유지 (간이영수증)
r = main.build_receipt(["김밥천국", "합계 8,000"])
m = main.merge_llm(r, {"merchant_name": "김밥천국", "total_amount": 8000, "supply_value": None, "vat": None})
assert (m.supply_value, m.vat) == (7273, 727), m

# LLM이 텍스트에 있는 올바른 합계를 찾음 → 채택하고 세금 재계산
r = main.build_receipt(["가게", "카드 99,000,000", "힙게 11,000"])
m = main.merge_llm(r, {"total_amount": 11000, "supply_value": None, "vat": None})
assert (m.total_amount, m.supply_value, m.vat) == (11000, 10000, 1000), (r, m)

# LLM 세금값: 텍스트에 있고 합계와 맞으면 채택
r = main.build_receipt(["가게", "과세 9,000", "세금 900", "면세 1,100", "합계 11,000"])
m = main.merge_llm(r, {"total_amount": 11000, "supply_value": 9000, "vat": 900, "tax_free_amount": 1100})
assert (m.supply_value, m.vat, m.tax_free_amount) == (9000, 900, 1100), m

# 합계와 오차 범위 안이어도 텍스트에 없는 값(1,310)은 거부
r = main.build_receipt(["스타벽스", "공급가액 13,182", "부가세 1,31B", "합계 14,500"])
m = main.merge_llm(r, {"total_amount": 14500, "supply_value": 13182, "vat": 1310})
assert m.vat == 1318, m

# Ollama 없음 → 오류 없이 원래 결과 유지
low = main.build_receipt(["스타벅스", "합계 14,500"])
assert asyncio.run(main.verify_with_ollama(low, [])) == low

print("OK")
