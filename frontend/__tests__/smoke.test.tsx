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
    expect(screen.getAllByText(/Medius/i).length).toBeGreaterThan(0)
  })

  it('renders Start my dispute CTA', () => {
    render(<Home />)
    expect(screen.getByText(/Start my dispute/i)).toBeTruthy()
  })

  it('renders How it works section', () => {
    render(<Home />)
    expect(screen.getByText(/How it works/i)).toBeTruthy()
  })
})
