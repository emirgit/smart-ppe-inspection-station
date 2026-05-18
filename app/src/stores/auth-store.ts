import { create } from 'zustand'

const TOKEN_KEY = 'ppe_admin_token'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  clearToken: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, isAuthenticated: true })
  },
  clearToken: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, isAuthenticated: false })
  },
}))

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
