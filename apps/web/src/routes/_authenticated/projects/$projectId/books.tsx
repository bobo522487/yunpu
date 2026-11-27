import { createFileRoute } from '@tanstack/react-router'
import BooksPage from '@/features/books/pages/BooksPage'

export const Route = createFileRoute('/_authenticated/projects/$projectId/books')({
  component: BooksPage,
})
