# Design Tokens — Autoprocs Dispatcher

> Tokens visuais aplicados via CSS custom properties em `src/app/globals.css`.
> Referência: identidade corporativa azul + branco, minimalista, inspirada em powercomm.com.br.
>
> **Status**: defaults corporativos. Refinar com hex codes exatos quando disponibilizados.

## Paleta — Light

| Token | OKLCH | Uso |
|-------|-------|-----|
| `--background` | `oklch(1 0 0)` | Fundo principal |
| `--foreground` | `oklch(0.145 0 0)` | Texto principal |
| `--primary` | `oklch(0.52 0.21 263)` | Azul corporativo (botões, ações, links) |
| `--primary-foreground` | `oklch(0.985 0 0)` | Texto sobre primary |
| `--muted` | `oklch(0.97 0 0)` | Backgrounds secundários |
| `--muted-foreground` | `oklch(0.556 0 0)` | Texto secundário |
| `--border` | `oklch(0.922 0 0)` | Bordas |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Erros, ações destrutivas |
| `--sidebar` | `oklch(0.985 0 0)` | Fundo sidebar |
| `--sidebar-accent` | `oklch(0.95 0.03 263)` | Item ativo sidebar (azul claro) |
| `--sidebar-accent-foreground` | `oklch(0.42 0.21 263)` | Texto item ativo |

## Paleta — Dark

| Token | OKLCH | Uso |
|-------|-------|-----|
| `--background` | `oklch(0.145 0 0)` | Fundo principal |
| `--foreground` | `oklch(0.985 0 0)` | Texto principal |
| `--primary` | `oklch(0.65 0.2 263)` | Azul claro |
| `--sidebar` | `oklch(0.18 0 0)` | Fundo sidebar |
| `--sidebar-accent` | `oklch(0.28 0.05 263)` | Item ativo sidebar |

## Tipografia

| Token | Valor |
|-------|-------|
| `--font-sans` | `Inter` + system fallbacks |
| Pesos usados | 400 (body), 500 (médio), 600 (semibold), 700 (bold em h1) |

Carregada via `next/font/google` em `src/app/layout.tsx`.

## Raios

| Token | Valor |
|-------|-------|
| `--radius` | `0.5rem` |
| `--radius-sm` | `calc(--radius - 4px)` = `0.25rem` |
| `--radius-md` | `calc(--radius - 2px)` = `0.375rem` |
| `--radius-lg` | `--radius` = `0.5rem` |
| `--radius-xl` | `calc(--radius + 4px)` = `0.75rem` |

## Espaçamento

Usa escala padrão Tailwind v4 (`spacing-1` a `spacing-96`). Sem override.

## Componentes shadcn instalados

- `button`, `avatar`, `badge`, `card`, `dropdown-menu`, `input`, `label`, `sonner`
- `sidebar` (+ sheet, tooltip, separator, skeleton como deps internas)

## A refinar

- Hex codes exatos da powercomm (precisa screenshot/inspect).
- Possível tipografia secundária pra títulos grandes (mantém Inter por enquanto).
- Tons de azul mais saturados se identidade pedir.
