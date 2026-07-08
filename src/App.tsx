import { AuthGate } from './components/AuthGate'

export default function App() {
  return (
    <AuthGate>
      <div className="app">已登录</div>
    </AuthGate>
  )
}
