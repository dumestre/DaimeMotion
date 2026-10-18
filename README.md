# Daime Motion

Estúdio audiovisual local com interface React/Vite, backend Node.js e projetos HyperFrames. Os dados permanecem no computador; a interface e a API escutam somente em loopback.

## Requisitos

- Windows 10/11
- Node.js 22 ou superior e npm
- FFmpeg disponível no `PATH`
- OpenCode instalado e com um provedor configurado

O HyperFrames CLI é instalado como dependência compartilhada do aplicativo (`hyperframes`). Ele não é copiado para as pastas dos projetos. O backend também aceita o CLI disponível no `PATH`.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173`. O backend local usa `http://127.0.0.1:4317`.

Para validar e executar a versão compilada:

```powershell
npm test
npm run build
npm start
```

Em execução compilada, o servidor entrega a interface em `http://127.0.0.1:4317`.

## Integrações

- HyperFrames: cada projeto é inicializado pelo comando oficial `hyperframes init`; a animação é reproduzida diretamente no navegador com `hyperframes play`, sem renderizar um arquivo de vídeo. A exportação MP4, quando solicitada, usa `hyperframes render -o`.
- Criação de projeto: o inicializador oficial do HyperFrames pode instalar skills globais de agentes a partir do GitHub. A aplicação exige confirmação explícita antes de chamar esse inicializador.
- OpenCode: as instruções são passadas ao comando oficial `opencode run --format json --dir <projeto> <instrução>`, sem shell. O OpenCode mantém suas próprias permissões e credenciais; configure um provedor antes de enviar uma instrução.
- FFmpeg/ffprobe: necessários pelo HyperFrames para renderização e, quando disponíveis, leitura da duração de áudio e vídeo.

## Projetos e dados

Por padrão, configurações e projetos são guardados em `%LOCALAPPDATA%\DaimeMotion`. Para usar outro diretório, defina `DAIMEMOTION_HOME` antes de iniciar o backend. A porta HTTP pode ser ajustada com `DAIME_PORT`.

Cada projeto é inicializado pelo HyperFrames, recebe seu próprio `AGENTS.md` e diretório `assets/`. Exportações são gravadas em `exports/` dentro do projeto. A animação no estúdio é a composição HTML reproduzida em tempo real no player do navegador; isso não cria nem renderiza um vídeo. A exportação MP4 é separada e só começa quando solicitada pela interface.

## Limitações conhecidas do MVP

- O backend é local e a biblioteca de projetos persiste em disco; tarefas e sessões do player vivem apenas enquanto o backend está executando.
- Fontes são importadas como assets do projeto; instalação de fontes no Windows não é feita pelo aplicativo.
- A pasta de exportação é interna ao projeto para evitar caminhos de saída arbitrários.
- O OpenCode, FFmpeg e suas configurações continuam sendo dependências externas do ambiente.
