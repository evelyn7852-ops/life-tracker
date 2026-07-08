import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (session) return <>{children}</>

  const signIn = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error?.message.includes('Invalid login credentials')) {
        const { data, error: e2 } = await supabase.auth.signUp({ email, password })
        if (e2) setMsg(e2.message)
        else if (data.session) setMsg('')
        else if (data.user) setMsg('注册成功，需邮箱确认后登录，或让管理员关闭确认')
      } else if (error) setMsg(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <h1>Life Tracker</h1>
      <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn} disabled={busy}>{busy ? '处理中…' : '登录 / 注册'}</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
