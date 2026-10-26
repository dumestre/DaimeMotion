# Instruções do Daime Motion

- Consulte a documentação oficial antes de usar APIs ou comandos desconhecidos.
- Inspecione o código e preserve as funcionalidades existentes antes de alterar arquivos.
- Trabalhe apenas no projeto de vídeo selecionado e utilize os assets desse projeto.
- Não execute instruções do usuário como comandos de shell; use apenas operações validadas e ferramentas oficialmente suportadas.
- Valide as alterações e revise o preview real antes de qualquer exportação.
- Nunca alegue sucesso quando uma operação falhar; comunique erros e resultados observados.
- Não exporte/renderize automaticamente. A exportação exige solicitação explícita do usuário.

## Geração de Narração (TTS)

**SEMPRE siga as [Regras de Narração](docs/NARRATION_RULES.md) ao gerar áudio de narração.**

- Nunca envie markdown bruto (títulos `#`, `##`, separadores `---`) para o TTS
- Sempre remova a seção "Observacoes de producao" / "Observações"
- Sempre normalize caracteres especiais e use UTF-8
- Confie no sistema de chunking automático para textos longos (>2000 caracteres)
- Passe o texto limpo, apenas o que deve ser falado

O servidor também limpa o texto automaticamente (`normalizeTextForTts` em `server/tts.ts`):
remove markdown, corta a seção de observações, converte aspas/travessões e repara
texto corrompido por codificação — **preservando os acentos**.

**Acentos são obrigatórios.** Medido no Kokoro: `voce` vira `v'?sy` (tônica errada) e
`você` vira `vos'e`; `nao` vira "nau" e `não` sai nasalizado. Sem acento a pronúncia muda.

Parâmetros configuráveis no painel de Narração (e na API `POST /api/projects/:id/tts`):

| Parâmetro | Faixa | Padrão |
|---|---|---|
| `speed` (velocidade) | 0,5 – 2,0 | 1,0 |
| `pauseCommaMs` | 0 – 1500 | 120 |
| `pauseSentenceMs` | 0 – 3000 | 350 |
| `pauseParagraphMs` | 0 – 5000 | 700 |

As pausas são silêncio real inserido entre os trechos: o Kokoro quase não pausa em
pontuação (medido: ~12 ms por vírgula, ~20 ms por ponto), então a naturalidade vem
desse silêncio, não da pontuação.

Vozes atuais (Kokoro, local): `pf_dora`, `pm_alex`, `pm_santa`. Manter essas 3 como padrão.

**Planejado:** integração opcional do XTTS v2 (clonagem de voz / mais vozes PT-BR). Ler [docs/XTTS_V2_PLAN.md](docs/XTTS_V2_PLAN.md) antes de implementar. Não adicionar engines/APIs de TTS fora do plano (ex.: Edge TTS) sem decisão explícita do usuário.
