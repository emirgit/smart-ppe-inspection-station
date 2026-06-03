export class ApiError extends Error {
  code: number
  constructor(code: number, message: string)
}

type ApiResponse<T = unknown> = Promise<{
  success: boolean
  data: T
  total?: number
  limit?: number
  offset?: number
  message?: string
}>

type Query = Record<string, string | number | boolean | undefined>

export const api: {
  listWorkers(q?: Query): ApiResponse<unknown[]>
  createWorker(body: Record<string, unknown>): ApiResponse<{ id: number }>
  getWorkerById(id: number): ApiResponse<unknown>
  updateWorker(id: number, body: Record<string, unknown>): ApiResponse<unknown>
  softDeleteWorker(id: number): ApiResponse<unknown>
  hardDeleteWorker(id: number): ApiResponse<unknown>
  reactivateWorker(id: number): ApiResponse<unknown>
  uploadWorkerPhoto(id: number, file: File): ApiResponse<unknown>
  deleteWorkerPhoto(id: number): ApiResponse<unknown>
  listRoles(): ApiResponse<unknown[]>
  createRole(body: Record<string, unknown>): ApiResponse<unknown>
  updateRole(id: number, body: Record<string, unknown>): ApiResponse<unknown>
  deleteRole(id: number): ApiResponse<unknown>
  getRolePpe(id: number): ApiResponse<unknown>
  replaceRolePpe(id: number, body: Record<string, unknown>): ApiResponse<unknown>
  listPpeItems(): ApiResponse<unknown[]>
  listEntryLogs(q?: Query): ApiResponse<unknown[]>
  getEntryLogStats(q?: Query): ApiResponse<unknown>
  getWorkerDigitalTwin(id: number): ApiResponse<unknown>
}

export const authApi: {
  login(email: string, password: string): ApiResponse<unknown>
  signup(name: string, email: string, password: string): ApiResponse<unknown>
  me(): ApiResponse<unknown>
}

export function resolveAssetUrl(value?: string | null): string
