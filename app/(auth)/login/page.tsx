import { AuthForm } from '@/components/auth/AuthForm'
import { ClipboardList, BarChart3, Users, Radio } from 'lucide-react'

const features = [
  { icon: ClipboardList, title: '試合記録', description: '打席・投球をリアルタイム記録' },
  { icon: BarChart3, title: '成績管理', description: '打率・防御率を自動集計' },
  { icon: Users, title: 'チーム管理', description: '選手登録・オーダー編成' },
  { icon: Radio, title: 'ライブ共有', description: 'スコアをリアルタイム共有' },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-md space-y-6">
        <section className="text-center space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">
            ⚾ 草野球スコアブック
          </h1>
          <p className="text-muted-foreground text-sm">
            草野球の試合をかんたんに記録・管理できるアプリ
          </p>
        </section>

        <section className="grid grid-cols-4 gap-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border bg-card p-3 text-center space-y-1"
            >
              <feature.icon className="h-5 w-5 text-primary mx-auto" />
              <p className="font-medium text-xs">{feature.title}</p>
              <p className="text-muted-foreground text-[10px] leading-tight hidden sm:block">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        <AuthForm mode="login" />
      </div>
    </div>
  )
}
