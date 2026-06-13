import { AiBadge } from './AiBadge'
import { PrivacyLine } from './PrivacyLine'
import { WontDoList } from './WontDoList'
import { TalkToHuman } from './TalkToHuman'

interface TrustLayerProps {
  showAiBadge?: boolean
}

export function TrustLayer({ showAiBadge = false }: TrustLayerProps) {
  return (
    <div className="space-y-3" data-testid="trust-layer">
      {showAiBadge && <AiBadge />}
      <PrivacyLine />
      <WontDoList />
      <div className="pt-1">
        <TalkToHuman />
      </div>
    </div>
  )
}
