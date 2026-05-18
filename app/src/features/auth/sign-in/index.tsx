import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HardHat, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'

export function SignIn() {
  const navigate = useNavigate()
  const { setToken } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Email ve şifre gerekli.'); return }
    setLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Giriş başarısız')
      }
      const token = json.data?.token || json.token
      if (!token) throw new Error('Token alınamadı')
      setToken(token)
      toast.success('Giriş başarılı')
      navigate({ to: '/' })
    } catch (err: any) {
      toast.error(err.message || 'Sunucuya bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary)' }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 1rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <HardHat size={24} style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>PPE Admin Panel</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Yönetici hesabınızla giriş yapın</p>
        </div>

        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@gebze.edu.tr"
                autoComplete="email"
                style={{ fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ fontSize: '13px', width: '100%', paddingRight: '36px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)' }}
                  aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: '4px', width: '100%', padding: '9px', fontSize: '13px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
          AI-Powered Smart PPE Inspection Station — Group 11
        </p>
      </div>
    </div>
  )
}
