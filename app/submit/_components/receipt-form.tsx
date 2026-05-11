'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { submitReceipt } from '@/app/actions/receipts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Upload, Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'

interface CategorizeResult {
  amount: number
  merchant: string
  extracted_text: string
  ocr_failed: boolean
  supply_value: number | null
  vat: number | null
  tax_free_amount: number | null
}

interface ReceiptFormProps {
  userId: string
}

export function ReceiptForm({ userId }: ReceiptFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [categorizing, setCategorizing] = useState(false)
  const [categorizeResult, setCategorizeResult] = useState<CategorizeResult | null>(null)

  const [amount, setAmount] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState('미분류')
  const [supplyValue, setSupplyValue] = useState('')
  const [vat, setVat] = useState('')
  const [taxFreeAmount, setTaxFreeAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setCategorizeResult(null)

    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        toast.error('이미지 업로드 실패: ' + uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(uploadData.path)
      setImageUrl(publicUrl)
      setImagePreview(URL.createObjectURL(file))

      // Auto-categorize
      setCategorizing(true)
      const catRes = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      })

      if (catRes.ok) {
        const catData: CategorizeResult = await catRes.json()
        setCategorizeResult(catData)
        if (catData.amount > 0) setAmount(String(catData.amount))
        if (catData.merchant) setMerchantName(catData.merchant)
        if (catData.supply_value != null) setSupplyValue(String(catData.supply_value))
        if (catData.vat != null) setVat(String(catData.vat))
        if (catData.tax_free_amount != null) setTaxFreeAmount(String(catData.tax_free_amount))
        if (catData.ocr_failed) {
          toast.error('OCR 서버에 연결할 수 없습니다. 직접 입력해주세요.')
        } else {
          toast.success('영수증 인식 완료. 내용을 확인해주세요.')
        }
      }
    } finally {
      setUploading(false)
      setCategorizing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !merchantName || !date) {
      toast.error('금액, 상호명, 날짜는 필수 항목입니다.')
      return
    }

    setSubmitting(true)
    try {
      const result = await submitReceipt({
        amount: Number(amount),
        merchant_name: merchantName,
        date,
        memo: memo || null,
        image_url: imageUrl || null,
        category,
        is_manual_review: false,
        supply_value: supplyValue ? Number(supplyValue) : null,
        vat: vat ? Number(vat) : null,
        tax_free_amount: taxFreeAmount ? Number(taxFreeAmount) : null,
      })

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('영수증이 제출되었습니다.')
        // 폼 초기화
        setAmount('')
        setMerchantName('')
        setDate(new Date().toISOString().split('T')[0])
        setMemo('')
        setCategory('미분류')
        setSupplyValue('')
        setVat('')
        setTaxFreeAmount('')
        setImageUrl('')
        setImagePreview('')
        setCategorizeResult(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">영수증 신청</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이미지 업로드 */}
          <div className="space-y-2">
            <Label>영수증 이미지</Label>
            <div
              className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative h-40 w-full">
                  <Image src={imagePreview} alt="영수증 미리보기" fill className="object-contain rounded" />
                </div>
              ) : (
                <>
                  {uploading || categorizing ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {uploading ? '업로드 중...' : categorizing ? '카테고리 분석 중...' : '클릭하여 이미지 선택'}
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || categorizing}
            />
          </div>

          {categorizeResult && !categorizeResult.ocr_failed && (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
              <span>OCR 인식 완료. 금액·상호명을 확인하고 카테고리를 직접 입력해주세요.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">금액 (원) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min={1}
              />
            </div>
            <div className="space-y-2">
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

          <div className="space-y-2">
            <Label htmlFor="merchantName">상호명 *</Label>
            <Input
              id="merchantName"
              placeholder="스타벅스 강남점"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplyValue">공급가액</Label>
              <Input
                id="supplyValue"
                type="number"
                min={0}
                placeholder="0"
                value={supplyValue}
                onChange={(e) => setSupplyValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">부가세</Label>
              <Input
                id="vat"
                type="number"
                min={0}
                placeholder="0"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxFreeAmount">면세금액</Label>
              <Input
                id="taxFreeAmount"
                type="number"
                min={0}
                placeholder="0"
                value={taxFreeAmount}
                onChange={(e) => setTaxFreeAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>카테고리</Label>
            <div className="flex gap-2 flex-wrap">
              {['복리후생비', '소모품비', '출장비', '접대비', '기타'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    category === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <Input
              placeholder="직접 입력"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              placeholder="추가 설명을 입력하세요..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || uploading || categorizing}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              '영수증 제출'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
