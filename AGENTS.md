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
