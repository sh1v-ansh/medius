import { render, screen } from '@testing-library/react'
import Home from '../app/page'

// Mock next/link to avoid router context requirement in tests
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('Home page', () => {
  it('renders Medius heading', () => {
    render(<Home />)
    expect(screen.getByText(/Medius/i)).toBeInTheDocument()
  })

  it('renders Talk to a human button', () => {
    render(<Home />)
    expect(screen.getByTestId('talk-to-human')).toBeTruthy()
  })

  it('renders What we wont do list', () => {
    render(<Home />)
    expect(screen.getByTestId('wont-do-list')).toBeTruthy()
  })
})
