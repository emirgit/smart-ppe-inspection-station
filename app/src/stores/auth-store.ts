import { create } from 'zustand'

const TOKEN_KEY = 'ppe_admin_token'

type AuthUser = {
  accountNo?: string
  email: string
  role?: string[]
  exp?: number
}

type LegacyAuthState = {
  user: AuthUser | null
  accessToken: string
  setUser: (user: AuthUser | null) => void
  setAccessToken: (token: string) => void
  resetAccessToken: () => void
  reset: () => void
}

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  user: AuthUser | null
  setToken: (token: string) => void
  clearToken: () => void
  auth: LegacyAuthState
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = localStorage.getItem(TOKEN_KEY) || ''

  const setToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    set((state) => ({
      token,
      isAuthenticated: true,
      auth: { ...state.auth, accessToken: token },
    }))
  }

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY)
    set((state) => ({
      token: null,
      isAuthenticated: false,
      auth: { ...state.auth, accessToken: '' },
    }))
  }

  const setUser = (user: AuthUser | null) => {
    set((state) => ({
      user,
      auth: { ...state.auth, user },
    }))
  }

  const reset = () => {
    localStorage.removeItem(TOKEN_KEY)
    set((state) => ({
      token: null,
      isAuthenticated: false,
      user: null,
      auth: { ...state.auth, user: null, accessToken: '' },
    }))
  }

  return {
    token: initialToken || null,
    isAuthenticated: !!initialToken,
    user: null,
    setToken,
    clearToken,
    auth: {
      user: null,
      accessToken: initialToken,
      setUser,
      setAccessToken: setToken,
      resetAccessToken: clearToken,
      reset,
    },
  }
})

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
