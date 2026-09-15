import type { KeyboardCoordinateGetter } from '@dnd-kit/core'

export const coordenadasColuna: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects, over } }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return

  event.preventDefault()
  if (!collisionRect) return

  const direcao = event.code === 'ArrowRight' ? 1 : -1
  const colunaAtualId = over?.id

  let melhorId: string | number | null = null
  let melhorDistancia = Infinity

  droppableRects.forEach((rect, id) => {
    if (id === colunaAtualId) return
    const delta = (rect.left - collisionRect.left) * direcao
    if (delta > 0 && delta < melhorDistancia) {
      melhorDistancia = delta
      melhorId = id
    }
  })

  if (melhorId === null) return

  const rectAlvo = droppableRects.get(melhorId)
  if (!rectAlvo) return

  return { x: rectAlvo.left, y: rectAlvo.top }
}
