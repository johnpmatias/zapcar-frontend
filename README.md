# ZapCar — Painel do Lojista

Front-end da "Fundação" do ZapCar: React + Vite + TypeScript + Tailwind + shadcn/ui, com autenticação via Supabase Auth.

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de variáveis de ambiente e preencha os valores:

   ```bash
   cp .env.example .env.local
   ```

   Edite `.env.local` com os valores do seu projeto Supabase:

   - `VITE_SUPABASE_URL`: a URL do projeto.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: a chave **publishable** (não a `secret`!), encontrada em Settings → API Keys no painel do Supabase. Usar a chave errada aqui já custou bastante tempo de debug — confira o tipo da chave antes de colar.

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

## Variável de ambiente adicional (Vercel)

A busca de dados por placa (`api/consulta-placa.ts`) depende de `APIPLACAS_TOKEN`, configurada em Settings → Environment Variables do projeto na Vercel — **nunca** como `VITE_*` nem commitada no repositório.

## Build

```bash
npm run build
```

## Testes

```bash
npm test
```

Cobre a suíte automatizada (unitária/integração). Não substitui uma verificação manual em ambiente real (Supabase + `vercel dev`) antes de um release.

## Deploy

Pushes para `main` são publicados automaticamente no Vercel.
