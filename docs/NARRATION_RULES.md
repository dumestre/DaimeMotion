# Regras para Geração de Narração (TTS)

Estas regras devem ser seguidas SEMPRE que gerar narração para vídeos no Daime Motion, independentemente do agente (OpenCode, Cline, Kilo, etc.).

## 1. Formato do arquivo de narração

- **Arquivo fonte**: `NARRACAO.md` na raiz do projeto (ex.: `data/projects/<id>/NARRACAO.md`)
- **Codificação**: UTF-8 sempre
- **Formato**: Markdown limpo, com parágrafos separados por linha em branco (`\n\n`)

## 2. O que NUNCA deve ir para a narração

Remova obrigatoriamente antes de enviar ao TTS:

- **Cabeçalhos Markdown** (`#`, `##`, `###`) - títulos de cena não são narrados
- **Separadores** (`---`)
- **Seção de observações**: qualquer conteúdo a partir de `## Observacoes` ou `## Observações de produção`
- **Notas de produção**: instruções técnicas, pausas, trilha sonora, etc.
- **Metadados**: informações para edição, não para voz

## 3. Normalização de caracteres

Para evitar erros no TTS e problemas com o script Python:

- **Acentos (agudo, til, circunflexo, cedilha)**: NUNCA remover. São eles que definem a pronúncia.
  Medido no Kokoro: `voce` → `v'?sy` (tônica errada), `você` → `vos'e`; `nao` → "nau",
  `não` → nasalizado; `avo` / `avô` / `avó` geram três pronúncias diferentes.
- **Codificação**: o arquivo deve estar em UTF-8. Texto salvo em cp1252 aparece como
  `nÃ£o` e o sistema repara automaticamente, mas o correto é gravar em UTF-8 desde o início.
- **Aspas curvas**: converter `" "` (U+201C/U+201D) e `' '` para aspas retas
- **Apóstrofos tipográficos**: converter para `'` normal
- **Travessões**: converter `—` (U+2014) e `–` (U+2013) para `-` ou manter como pontuação natural
- **Caracteres zero-width**: remover `\u200B`, `\u200C`, `\u200D`, `\uFEFF`
- **Caracteres de controle**: remover exceto `\n`, `\t`, `\r`

## 3.1 Parâmetros de voz (naturalidade)

O painel de Narração expõe estes controles (também disponíveis na API):

| Parâmetro | Faixa | Padrão | Observação |
|---|---|---|---|
| Velocidade (`speed`) | 0,5 – 2,0 | 1,0 | Fator real do Kokoro |
| Pausa em vírgula (`pauseCommaMs`) | 0 – 1500 ms | 120 ms | Após `,` `;` `:` |
| Pausa em ponto (`pauseSentenceMs`) | 0 – 3000 ms | 350 ms | Após `.` `!` `?` `…` |
| Pausa entre parágrafos (`pauseParagraphMs`) | 0 – 5000 ms | 700 ms | Em quebra de parágrafo |

**Importante:** o Kokoro quase não pausa em pontuação (medido: ~12 ms por vírgula e
~20 ms por ponto). A naturalidade vem do silêncio inserido pelo sistema entre os trechos,
não da pontuação em si. Ajuste os valores acima em vez de encher o texto de reticências.

Narração mais natural, na prática:
- Frases curtas e bem pontuadas
- Vírgula 100–150 ms, ponto 350–450 ms, parágrafo 700–900 ms
- Velocidade 0,9–1,0 para documentário; 1,1 para conteúdo dinâmico
- Não use CAPS LOCK para ênfase (o modelo lê letra por letra em alguns casos)

## 4. Estrutura para boa narração

- **Parágrafos**: mantenha parágrafos separados por `\n\n` - isso cria pausas naturais
- **Frases completas**: evite frases muito longas sem pontuação
- **Quebras excessivas**: normalize para no máximo `\n\n` (2 quebras consecutivas)
- **Texto limpo**: apenas o texto a ser falado

## 5. Processo de geração

1. **Ler** o arquivo `NARRACAO.md` do projeto
2. **Filtrar** cabeçalhos, separadores e seção de observações
3. **Normalizar** caracteres e quebras de linha
4. **Dividir** em chunks (automático - o sistema já faz isso)
5. **Gerar** via TTS com chunking + concatenação
6. **Salvar** em `assets/` como MP3

## 6. Regras para o agente

- **Sempre limpar** antes de gerar - nunca envie markdown bruto para o TTS
- **Nunca incluir** instruções de produção na narração
- **Preservar** acentos em português (são importantes!)
- **Manter** pontuação natural para melhor entonação
- **Usar UTF-8** sempre ao ler/escrever
- **Para textos muito grandes** (>10k caracteres), confiar no chunking automático do sistema
- **Ajustar pausas e velocidade** nos controles do painel, não no texto

## Exemplo prático

**Errado (não fazer):**
```markdown
## Cena 01 - Introdução
Narrador: Olá, bem vindos...
--- 
Observações: usar voz feminina...
```

**Certo (fazer):**
```text
Olá, bem vindos ao vídeo sobre o fascismo. Uma palavra que voltou a circular...

Essa é a chave inicial: o fascismo valoriza a unidade compulsória sobre a liberdade.
```

---

**IMPORTANTE**: Estas regras são obrigatórias. O sistema de TTS agora faz limpeza automática, mas seguir estas regras garante melhor qualidade e evita problemas.
