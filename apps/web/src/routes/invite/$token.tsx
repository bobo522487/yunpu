import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/invite/$token')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/onboarding',
      search: { invite: params.token },
      replace: true,
    })
  },
  component: () => null,
})
