import { render, screen } from '@testing-library/react'
import Home from '../app/page'

describe('Home page', () => {
  it('renders Medius heading', () => {
    render(<Home />)
    expect(screen.getByText(/Medius/i)).toBeInTheDocument()
  })
})
