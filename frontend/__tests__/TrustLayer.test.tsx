import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrustLayer } from '../app/components/trust/TrustLayer'
import { WontDoList } from '../app/components/trust/WontDoList'
import { TalkToHuman } from '../app/components/trust/TalkToHuman'
import { PrivacyLine } from '../app/components/trust/PrivacyLine'
import { AiBadge } from '../app/components/trust/AiBadge'

describe('TrustLayer', () => {
  it('renders the Talk to a human button', () => {
    render(<TrustLayer />)
    expect(screen.getByTestId('talk-to-human')).toBeTruthy()
    expect(screen.getByText(/Talk to a human/i)).toBeTruthy()
  })

  it('renders the What we wont do list', () => {
    render(<TrustLayer />)
    expect(screen.getByTestId('wont-do-list')).toBeTruthy()
    expect(screen.getByText(/what we won't do/i)).toBeTruthy()
  })

  it('renders the privacy line', () => {
    render(<TrustLayer />)
    expect(screen.getByTestId('privacy-line')).toBeTruthy()
    expect(screen.getByText(/remove your name/i)).toBeTruthy()
  })

  it('does not render AI badge by default', () => {
    render(<TrustLayer />)
    expect(screen.queryByText(/AI didn't decide this/i)).toBeNull()
  })

  it('renders AI badge when showAiBadge=true', () => {
    render(<TrustLayer showAiBadge />)
    expect(screen.getByText(/AI didn't decide this/i)).toBeTruthy()
  })
})

describe('WontDoList', () => {
  it('lists all five items', () => {
    render(<WontDoList />)
    expect(screen.getByText(/Won't predict who wins/i)).toBeTruthy()
    expect(screen.getByText(/Won't share your information/i)).toBeTruthy()
    expect(screen.getByText(/Won't finalize any agreement/i)).toBeTruthy()
    expect(screen.getByText(/Won't make legal decisions/i)).toBeTruthy()
    expect(screen.getByText(/Won't score your credibility/i)).toBeTruthy()
  })
})

describe('TalkToHuman', () => {
  it('renders a button with accessible text', () => {
    render(<TalkToHuman />)
    const btn = screen.getByRole('button', { name: /Talk to a human/i })
    expect(btn).toBeTruthy()
  })
})

describe('PrivacyLine', () => {
  it('mentions name removal before AI reads', () => {
    render(<PrivacyLine />)
    expect(screen.getByText(/remove your name and address before the AI reads/i)).toBeTruthy()
  })
})

describe('AiBadge', () => {
  it('renders the badge text', () => {
    render(<AiBadge />)
    expect(screen.getByText(/AI didn't decide this/i)).toBeTruthy()
    expect(screen.getByLabelText(/AI did not decide this/i)).toBeTruthy()
  })
})
