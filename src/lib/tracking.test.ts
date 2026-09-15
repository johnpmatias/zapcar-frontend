import { describe, it, expect, afterEach } from 'vitest'
import { injetarMetaPixel, injetarGoogleTag } from '@/lib/tracking'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('injetarMetaPixel', () => {
  it('injeta o script do Meta Pixel com o id da loja', () => {
    injetarMetaPixel('123456789')

    const script = document.getElementById('zapcar-meta-pixel')
    expect(script).not.toBeNull()
    expect(script?.innerHTML).toContain("fbq('init','123456789')")
  })

  it('remove o script quando a função de limpeza é chamada', () => {
    const remover = injetarMetaPixel('123456789')
    remover()

    expect(document.getElementById('zapcar-meta-pixel')).toBeNull()
  })

  it('não injeta duas vezes se o script já existir', () => {
    injetarMetaPixel('123456789')
    injetarMetaPixel('123456789')

    expect(document.querySelectorAll('#zapcar-meta-pixel')).toHaveLength(1)
  })
})

describe('injetarGoogleTag', () => {
  it('injeta os dois scripts do Google Tag com o id da loja', () => {
    injetarGoogleTag('G-ABC123')

    const scriptExterno = document.getElementById('zapcar-google-tag-lib') as HTMLScriptElement | null
    const scriptConfig = document.getElementById('zapcar-google-tag-config')
    expect(scriptExterno?.src).toContain('G-ABC123')
    expect(scriptConfig?.innerHTML).toContain("gtag('config','G-ABC123')")
  })

  it('remove os dois scripts quando a função de limpeza é chamada', () => {
    const remover = injetarGoogleTag('G-ABC123')
    remover()

    expect(document.getElementById('zapcar-google-tag-lib')).toBeNull()
    expect(document.getElementById('zapcar-google-tag-config')).toBeNull()
  })
})
