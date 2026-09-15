export function formatarNumeroWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null

  let digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = `55${digitos}`
  }

  if (digitos.length < 12 || digitos.length > 13) return null
  return digitos
}

export function montarLinkWhatsapp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
