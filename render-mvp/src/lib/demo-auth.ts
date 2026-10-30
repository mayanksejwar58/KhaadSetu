/** Shared identity types for the browser UI. Actual demo authentication is server-side in server-auth.ts. */
export type DemoRole = 'farmer' | 'operator'

export type DemoIdentity = {
  id: string
  name: string
  role: DemoRole
  centreId?: string
  centreName?: string
  farmerId?: string
}
