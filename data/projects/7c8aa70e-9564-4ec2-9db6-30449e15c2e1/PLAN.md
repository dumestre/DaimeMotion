# Plano — Concluir video Fascismo (profissional, multi-parte)

## Objetivo
Transformar a base atual (9 cenas, 54s) em video profissional multi-parte com narração (voz masculina grave PT-BR), legendas, trilha, imagens e estrutura para ~10 min.

## Fases
1. Narracao: texto pronto em NARRACAO.md (1779 palavras, ~12 min). Gerar audio via Piper (PT-BR) em assets/voice/XX.wav + audio_meta.json.
2. Cenas: manter 9 cenas base; adicionar sub-cenas/expandir duracao conforme narração; inserir imagens, textos, legendas sincronizadas.
3. Audio: mixar voz + BGM (grave, tensao crescente) + SFX (whoosh, tick) com volumes adequados.
4. Legendas: queimadas sincronizadas com word timings.
5. Preview: validar no Studio (localhost:3003) frame a frame.
6. Render: exportar MP4 final apos aprovacao explicita.

## Entregas
- assets/voice/*.wav + audio_meta.json
- index.html + compositions atualizados
- ROTEIRO.md e NARRACAO.md (prontos)
- Preview validado

## Status atual
- Base visual: 9 cenas criadas
- ROTEIRO.md e NARRACAO.md: prontos
- Preview: rodando em localhost:3003
- Audio: pendente (Piper a instalar)
