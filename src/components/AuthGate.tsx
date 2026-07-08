import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (session) return <>{children}</>

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error?.message.includes('Invalid login credentials')) {
      const { error: e2 } = await supabase.auth.signUp({ email, password })
      setMsg(e2 ? e2.message : '已注册并登录')
    } else if (error) setMsg(error.message)
  }

  return (
    <div className="auth">
      <h1>Life Tracker</h1>
      <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn}>登录 / 注册</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
