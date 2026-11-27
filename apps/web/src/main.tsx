import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function bootstrapApp() {
  await useAuthStore.getState().bootstrap()
}

void bootstrapApp()

let previousStatus = useAuthStore.getState().status
let previousOnboarding = useAuthStore.getState().onboarding
let previousOrganizationId =
  useAuthStore.getState().defaultOrganization?.id ?? null

useAuthStore.subscribe((state) => {
  const organizationId = state.defaultOrganization?.id ?? null
  if (previousStatus !== 'anonymous' && state.status === 'anonymous') {
    queryClient.clear()
  }
  if (
    state.status !== previousStatus ||
    state.onboarding !== previousOnboarding ||
    organizationId !== previousOrganizationId
  ) {
    previousStatus = state.status
    previousOnboarding = state.onboarding
    previousOrganizationId = organizationId
    void router.invalidate()
  }
})

window.addEventListener('yunpu:unauthorized', () => {
  useAuthStore.getState().markUnauthorized()
})

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <RouterProvider router={router} />
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
