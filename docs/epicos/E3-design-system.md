# Épico E3 — Design system + layout shell

> Objetivo: aplicação tem identidade visual definida, layout principal navegável (sidebar + header), tema claro/escuro, e rotas placeholder pra todas as áreas do produto. **Sem autenticação real, sem dados** — toda navegação mockada.

## Critérios de aceite

- [ ] Tokens visuais definidos (cores primárias, neutras, fontes, raios) em `globals.css` e documentados em `docs/design-tokens.md`.
- [ ] Componentes shadcn instalados: `sidebar`, `avatar`, `badge`, `card`, `dropdown-menu`, `input`, `label`, `sonner`.
- [ ] Layout principal `(app)/layout.tsx` com sidebar colapsável + header.
- [ ] Header com workspace switcher (mockado) + dropdown de usuário (mockado) + toggle tema.
- [ ] Rotas placeholder funcionando: `/dashboard`, `/contatos`, `/templates`, `/segmentos`, `/comunicados`, `/configuracoes`.
- [ ] Sidebar navega entre rotas e marca rota ativa.
- [ ] Tema claro + escuro funcionam via `next-themes`.
- [ ] Home `/` continua sendo a landing (placeholder atual), separada do layout autenticado.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` passam.

## Stories

### E3-S1 — Refinar tokens visuais

Atualizar `globals.css` para identidade corporativa azul + branco + Inter, com:
- `--primary` em tom azul corporativo (ajustar L/C/H em OKLCH pra azul tipo IBM Carbon).
- `--ring` igual à primary.
- `--radius` 0.5rem (já está).
- Sidebar tokens: `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, etc (necessários pra shadcn sidebar v2).

### E3-S2 — Componentes shadcn

Adicionar via CLI:
```
sidebar, avatar, badge, card, dropdown-menu, input, label, sonner
```

Brings sub-components: separator, sheet, tooltip, skeleton, button (existe).

### E3-S3 — ThemeProvider + toggle

- Adicionar `next-themes`.
- `components/theme-provider.tsx`.
- `components/theme-toggle.tsx` (dropdown-menu com Sun/Moon/System).
- Plug no `app/layout.tsx`.

### E3-S4 — Layout autenticado

Estrutura:
```
src/app/
  (app)/
    layout.tsx        — sidebar + header
    dashboard/page.tsx
    contatos/page.tsx
    templates/page.tsx
    segmentos/page.tsx
    comunicados/page.tsx
    configuracoes/page.tsx
  page.tsx            — landing pública (existente)
  layout.tsx          — root (existente)
```

`(app)/layout.tsx` aplica:
- `SidebarProvider` (shadcn v2)
- `AppSidebar`
- `AppHeader` (workspace switcher + user menu + theme toggle)
- Container do conteúdo

### E3-S5 — AppSidebar

`components/app-sidebar.tsx`:
- Logo no topo.
- Grupo "Geral": Dashboard.
- Grupo "Comunicação": Contatos, Segmentos, Templates, Comunicados.
- Grupo "Configurações": Configurações.
- Marca item ativo via `usePathname`.

### E3-S6 — AppHeader

`components/app-header.tsx`:
- Workspace switcher (Combobox/Dropdown mockado com 2-3 workspaces de exemplo).
- Theme toggle.
- User menu (avatar + dropdown com "Perfil", "Sair" desabilitados).

### E3-S7 — Páginas placeholder

Cada rota tem:
- Título (h1).
- Breve descrição do que vai ser.
- Card centrado com mensagem "Em construção — feature X" + ícone Lucide.

### E3-S8 — Documentar tokens

`docs/design-tokens.md` lista cores, fontes, raios. Para referência futura.

## Saída do épico

Aplicação navegável visualmente. Pronta pra plugar auth (E1) e features (E4+).
