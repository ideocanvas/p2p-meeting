import { Video, Shield, Zap, Users, ArrowRight, Globe, Lock } from 'lucide-react'
import Link from 'next/link'
import { getDictionary, Locale } from '@/lib/i18n'
import { SiteHeader } from '@/components/site-header'
import BuyMeACoffee from '@/components/BuyMeACoffee'
import { Button } from '@/components/ui/button'

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const dict = await getDictionary(lang as Locale)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <SiteHeader lang={lang} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
        {/* Hero Section */}
        <div className="text-center mb-20 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Secure P2P Video Conferencing
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8">
            Video calls, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Simplified & Secure
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            {dict.home.heroDescription} No servers, no data collection, just you and your team.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${lang}/create`}>
              <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                {dict.home.startHosting} <Video className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href={`/${lang}/join`}>
              <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-2 hover:bg-gray-50 transition-all">
                {dict.home.joinMeeting} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          <FeatureCard 
            icon={<Shield className="w-8 h-8 text-indigo-600" />}
            title="End-to-End Privacy"
            description={dict.home.featurePrivateDesc}
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-amber-500" />}
            title="Lightning Fast"
            description="Direct Peer-to-Peer connection ensures the lowest possible latency for your calls."
          />
          <FeatureCard 
            icon={<Users className="w-8 h-8 text-emerald-500" />}
            title="Unlimited Access"
            description={dict.home.featureNoLimitsDesc}
          />
        </div>

        {/* Dashboard Promo */}
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 p-12 md:p-16 text-center">
            <h3 className="text-3xl font-bold mb-6">Manage Your Meeting Rooms</h3>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg">
              Create persistent meeting rooms with fixed links. Perfect for recurring team syncs, 
              client meetings, or family hangouts.
            </p>
            <Link href={`/${lang}/dashboard`}>
              <Button size="lg" variant="secondary" className="h-12 px-8 rounded-full font-semibold">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
      
      <BuyMeACoffee language={lang as 'en' | 'zh-TW'} />
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
      <div className="mb-4 bg-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  )
}