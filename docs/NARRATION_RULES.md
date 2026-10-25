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

- **Aspas curvas**: converter `" "` (U+201C/U+201D) e `' '` para aspas retas
- **Apóstrofos tipográficos**: converter para `'` normal
- **Travessões**: converter `—` (U+2014) e `–` (U+2013) para `-` ou manter como pontuação natural
- **Caracteres zero-width**: remover `\u200B`, `\u200C`, `\u200D`, `\uFEFF`
- **Caracteres de controle**: remover exceto `\n`, `\t`, `\r`

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
