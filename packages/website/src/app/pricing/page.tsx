import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Nav from '@/components/Nav'
import PricingCheckout from '@/components/pricing/PricingCheckout'

export const metadata: Metadata = {
  title: '价格方案',
  description:
    'MarkWeave 免费版、Pro 与商业版套餐对比。一次性购买，永久授权，支持支付宝、微信支付与国际卡。'
}

export default function PricingPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <PricingCheckout />
      <Footer />
    </>
  )
}
