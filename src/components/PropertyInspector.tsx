import type { CSSProperties } from 'react'
import { GROUP_COLORS, MONEY, PROPERTIES } from '../game/content'
import type { GameState } from '../types'

export function PropertyInspector({ state, tileId, onSelect }: { state: GameState; tileId?: string; onSelect: (tileId?: string) => void }) {
  const tile = PROPERTIES.find(value => value.id === tileId)
  const property = tile ? state.properties.find(value => value.tileId === tile.id) : undefined
  const owner = state.players.find(value => value.id === property?.ownerId)

  return <div className="property-inspector-shell">
    <label className="property-picker">
      <span>INSPECIONAR IMÓVEL</span>
      <select value={tileId ?? ''} onChange={event => onSelect(event.target.value || undefined)}>
        <option value="">Selecione no tabuleiro</option>
        {PROPERTIES.map(propertyTile => <option key={propertyTile.id} value={propertyTile.id}>{propertyTile.name}</option>)}
      </select>
    </label>
    {tile && property && <aside className="property-inspector" aria-live="polite" style={{ '--group': GROUP_COLORS[tile.group] } as CSSProperties}>
      <button type="button" className="property-inspector-close" onClick={() => onSelect(undefined)} aria-label="Fechar detalhes do imóvel">×</button>
      <span>{tile.district} · NÍVEL {property.level}/4</span>
      <strong>{tile.name}</strong>
      <dl>
        <div><dt>Proprietário</dt><dd>{owner?.nickname ?? 'Disponível'}</dd></div>
        <div><dt>Preço</dt><dd>{MONEY(tile.price)}</dd></div>
        <div><dt>Aluguel atual</dt><dd>{property.mortgaged ? 'Suspenso' : MONEY(tile.rents[property.level])}</dd></div>
        <div><dt>Melhorias</dt><dd>{property.level === 4 ? 'Hotel' : `${property.level} de 4`}</dd></div>
      </dl>
      {property.mortgaged && <b>HIPOTECADO</b>}
    </aside>}
  </div>
}
