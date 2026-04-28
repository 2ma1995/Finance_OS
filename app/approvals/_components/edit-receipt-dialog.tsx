'use client'

import { useEffect, useState } from 'react'
import { updateReceipt } from '@/app/actions/receipts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Receipt } from '@/types/database'

interface Props {
  receipt: Receipt | null
  onClose: () => void
  onSuccess: (updated: Receipt) => void
  hideSubmitterInfo?: boolean
}

const CATEGORIES = ['복리후생비', '소모품비', '출장비', '접대비', '기타', '미분류']

export function EditReceiptDialog({ receipt, onClose, onSuccess, hideSubmitterInfo = false }: Props) {
  const [merchantName, setMerchantName] = useState(receipt?.merchant_name ?? '')
  const [amount, setAmount] = useState(String(receipt?.amount ?? ''))
  const [date, setDate] = useState(receipt?.date ?? '')
  const [category, setCategory] = useState(receipt?.category ?? '')
  const [memo, setMemo] = useState(receipt?.memo ?? '')
  const [supplyValue, setSupplyValue] = useState(String(receipt?.supply_value ?? ''))
  const [vat, setVat] = useState(String(receipt?.vat ?? ''))
  const [taxFreeAmount, setTaxFreeAmount] = useState(String(receipt?.tax_free_amount ?? ''))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (receipt) {
      setMerchantName(receipt.merchant_name ?? '')
      setAmount(String(receipt.amount ?? ''))
      setDate(receipt.date ?? '')
      setCategory(receipt.category ?? '')
      setMemo(receipt.memo ?? '')
      setSupplyValue(String(receipt.supply_value ?? ''))
      setVat(String(receipt.vat ?? ''))
      setTaxFreeAmount(String(receipt.tax_free_amount ?? ''))
    }
  }, [receipt])

  const isOpen = receipt !== null

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receipt) return

    setLoading(true)
    const result = await updateReceipt(receipt.id, {
      merchant_name: merchantName,
      amount: Number(amount),
      date,
      category,
      memo: memo || null,
      supply_value: supplyValue ? Number(supplyValue) : null,
      vat: vat ? Number(vat) : null,
      tax_free_amount: taxFreeAmount ? Number(taxFreeAmount) : null,
    })
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('수정되었습니다.')
      onSuccess({
        ...receipt,
        merchant_name: merchantName,
        amount: Number(amount),
        date,
        category,
        memo: memo || null,
        supply_value: supplyValue ? Number(supplyValue) : null,
        vat: vat ? Number(vat) : null,
        tax_free_amount: taxFreeAmount ? Number(taxFreeAmount) : null,
      })
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>영수증 수정</DialogTitle>
        </DialogHeader>

        {receipt && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {receipt.image_url && (
              <a
                href={receipt.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-primary underline"
              >
                원본 이미지 보기 →
              </a>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">금액 (원) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">날짜 *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supplyValue">공급가액</Label>
                <Input
                  id="supplyValue"
                  type="number"
                  min={0}
                  placeholder="자동계산"
                  value={supplyValue}
                  onChange={(e) => setSupplyValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vat">부가세</Label>
                <Input
                  id="vat"
                  type="number"
                  min={0}
                  placeholder="자동계산"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxFreeAmount">기타</Label>
                <Input
                  id="taxFreeAmount"
                  type="number"
                  min={0}
                  placeholder="없음"
                  value={taxFreeAmount}
                  onChange={(e) => setTaxFreeAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="merchant">상호명 *</Label>
              <Input
                id="merchant"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">카테고리 *</Label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${category === cat
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Input
                id="category"
                placeholder="직접 입력"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="memo">메모</Label>
              <Textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                placeholder="추가 설명"
              />
            </div>

            <div className="flex justify-between pt-1">
              {!hideSubmitterInfo && (
                <p className="text-xs text-muted-foreground self-center">
                  신청자: {receipt.employee_name} · {receipt.department}
                </p>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>취소</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
