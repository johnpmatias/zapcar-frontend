import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { LandingComoFunciona } from '@/components/landing/LandingComoFunciona'
import { LandingCtaFinal } from '@/components/landing/LandingCtaFinal'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHero />
      <LandingFeatures />
      <LandingComoFunciona />
      <LandingCtaFinal />
      <LandingFooter />
    </div>
  )
}
