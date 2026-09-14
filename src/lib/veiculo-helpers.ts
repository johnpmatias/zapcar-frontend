export function gerarTitulo(marca: string, modelo: string, anoModelo: number): string {
  return `${marca} ${modelo} ${anoModelo}`
}

export function derivarPlacaFinal(placa: string | null | undefined): string | null {
  if (!placa) return null
  return placa.slice(-4)
}
