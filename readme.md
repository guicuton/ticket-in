# Ticket-In

Plataforma open-source para gestão de tickets de atendimento com usuários multi-nível, áreas de atendimento e tickets com threads de mensagens e níveis de prioridade.

# Tecnologias

Pensando na possível expansão rápida do projeto optei por desenvolver seguindo uma abordagem inspirada em **hexagonal / ports & adapters**, isolando as regras de domínio dos adaptadores de infraestrutura deixando um fluxo de requisição simplificado como:

1. `Controllers do backend` recebem o HTTP, validam input via DTO + `class-validator` e delegam ao _controller-service_ daquele recurso.
2. O _controller-service_ orquestra a chamada às regras de negócio em `libs/**/*` (camada de domínio).
3. O domínio fala com a persistência via repositórios em `libs/database/repositories/*`, que encapsulam o cliente Prisma.
4. Os adaptadores (`libs/cache` e `libs/auth`) são consumidos por injeção de dependência, permitindo trocar a implementação sem tocar no domínio.

Esse desenho mantém os controllers finos, o domínio livre de detalhes de infraestrutura e os adaptadores intercambiáveis.

- NestJS (Backend)
- Angular (frontend)
- Redis (Cache)
- Docker (Container)
- Postgres (Banco de dados)
- Prisma (ORM)

# Funções

- Gestão de usuários
- Usuário com níveis de acesso (ADMIN, MASTER e USER)
- Gestão de áreas
- Gestão de tickets
- Thread de mensagens de tickets

# Executando

## Produção

Requisito: Docker com Compose.

```bash
docker compose up --build -d
```

A stack sobe na ordem: Postgres e Redis, migrations, seed, backend e nginx.
A aplicação fica disponível em `http://localhost`. Nenhuma outra porta é publicada no host.

Postgres, Redis e backend só são alcançáveis dentro da network `ticketin`.

Contas criadas pelo seed, todas com a senha `123456`:

| Usuário   | Papel  |
| --------- | ------ |
| `admin`   | ADMIN  |
| `support` | MASTER |
| `user`    | USER   |

Para derrubar:
`docker compose down`.

Para derrubar apagando os volumes:
`docker compose down -v`.

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` sobe apenas Postgres e Redis em container, aguarda os healthchecks, aplica as migrations e inicia backend e frontend na máquina com
hot reload.

O Swagger fica em `http://localhost:3000/docs`

> O Swagger não fica exposto em produção

Scripts auxiliares:

| Script                     | O que faz                                                |
| -------------------------- | -------------------------------------------------------- |
| `npm run services:up`      | Sobe Postgres e Redis de desenvolvimento                 |
| `npm run services:down`    | Derruba os serviços de desenvolvimento                   |
| `npm run build`            | Gera o Prisma Client e compila backend e frontend        |
| `npm run migration:deploy` | Aplica as migrations pendentes                           |
| `npm run migration:create` | Cria uma nova migration a partir do schema               |
| `npm run migration:seed`   | Popula o banco com as contas padrão                      |
| `npm run prod:logs`        | Acompanha os logs da stack de produção                   |
| `npm run test`             | Rodada completa de testes unitários (backend e frontend) |
| `npm run test:backend`     | Rodada completa de testes unitários do backend           |
| `npm run test:frontend`    | Rodada completa de testes unitários do frontend          |

# ESCALABILIDADE

O backend é servido via PM2 com sistema de cache desacoplado da memória de processo. Isso permite que o app possa rodar em modo cluster e obter o máximo de desempenho da máquina.

Além disso, consultas de maior peso como listas estão com dados paginados ou cacheados (quando possivel), reduzindo absurdamente o peso sobre o banco de dados Postgres que foi escolhido devido a necessidade de relação de diversos dados entre diferentes tabelas, e por ser a opção que apesar de simples, tem um excelente custo-benefício de performance e escalabilidade com baixissima curva de aprendizado, mesmo quando usado fora de ORMs.

# TODO (Melhorias e a desenvolver)

## BACKEND

[] Sse para atualização de dados one-way conforme demanda
[] Implementação mensageria para comunicação externa para alertas
[] Observabilidade via Prometheus+Grafana
[x] CRUD módulo de accounts
[x] CRUD módulo de área
[x] CRUD módulo de tickets

## FRONTEND

[x] Gestão de usuários
[] Componentes de gestão de ticket
[] Componentes de gestão de áreas

## JWT

Atualmente JWT expira em 60 minutos.

O ideal seria um TTL curto de 10~15 minutos com revalidação dinâmica conforme setado pelo usuário no momento do login. Além disso remover do localStorage para cookies para melhorar a segurança.

## Sse (Server-side events)

Implpementação de SSE para atualização dos tickets e seus respectivos estados e níveis de prioridade

## Mensageria

Implementação de mensageria para envio de alertas sobre novos tickets e suas respectivas atualizações aos responsáveis e usuário criador.

## 2FA

Implementação de um simples MFA via Google Authenticator ou até mesmo uma mensagem via e-mail para simplicidade.

# Raciocinio Técnico

## Integração Resiliente

**1. Como você desenharia uma integração com uma API externa que possui limites de requisição (rate limiting) e instabilidade ocasional para garantir que seu sistema continue funcional?**

Para controlar a saida e evitar o rate limit, o ideal é usar algum sistema de mensageria para controlar o fluxo como o RabbitMQ que brilha nesse ponto. Para as instabilidades regras de reprocessamento com jitter exponencial e se possivel APIs de fallback para garantir a redundância da operação.

**2. Refinamento de Requisito: Ao receber uma demanda vaga da área de negócio, quais etapas você segue para transformá-la em uma especificação técnica pronta para desenvolvimento?**

Gosto de trabalhar sem achismos.
Achismos custam tempo, dinheiro e oportunidades.
Nesse cenário, acredito queo mais assertivo é retornar com a área de negócios e entender de onde, como e porque surgiu a demanda. Dessa forma podemos ter juntos todo o histórico da real necessidade e conseguir modelar o produto para depois então, entrar no desenvolvimento e analisar as tecnologias necessárias.

**3. Idempotência: Em uma API de pagamentos ou pedidos, como você evita que o processamento seja duplicado em caso de retentativas do cliente?**

Na request do client podemos enviar um token único que pode ser armazenado em cache (SetNx pra garantir somente uma escrita) com um TTL razoável.
Além disso, podemos ter esse mesmo token como **único** no banco de dados de tal forma que se eventualmente o cache falhar, uma consulta no banco de dados nos dará a redundância de garantia antes de enviar o novo request ao vendor.

**4. Síncrono vs. Assíncrono: Quais critérios definem se um fluxo deve ser resolvido imediatamente na requisição HTTP ou processado em segundo plano (fila)?**

Particularmente, gosto de jogar para fila processos que sejam "pesados" para o banco de dados como exportar ou importar dados e chamadas a API externas para poder ter melhor controle de reprocessamento e controle de TPS. Demais operações de pouco custo e que estão paginadas ou cacheadas em modo síncrono.

**5. Segurança: Quais controles mínimos de segurança você aplica em uma API exposta publicamente?**

- Rate limit
- Requisição autenticada por token (jwt por exemplo)
- Ip firewall (somente ips autorizados)
- DTOs de validação de entrada de dados

**6. Qualidade e Entrega: Como você decide o que é essencial para uma primeira versão (MVP) e o que deve ser tratado como débito técnico ou melhoria futura?**

Isso é completamente dinâmico a cada cenário, mas em termos gerais tenho a premissa de "melhor feito e imperfeito que não feito e perfeito", ou seja, vou preferir entregar algo mesmo sabendo que esteja falho ou "não ideal" em determinados pontos, porque os usuários é que vão ditar o que é essencial a partir de feedbacks.

**7. Governança e IA: Como utilizar IA para acelerar o desenvolvimento sem comprometer a segurança dos dados e a qualidade do código a longo prazo?**

Hoje a IA está presente em tudo e é impossível não utilizá-la, mas gosto muito de usar uma frase que o Fabio Akita usou num podcast:

> Uma pessoa analfabeta que não sabe usar um papel e caneta, também vai ser analfabeta com um tablet

E dentro do nosso contexto significa simplesmente que um "desenvolvedor" que não sabe muito bem os fundamentos, nunca vai ser um desenvolvedor porque publicou seu app _vibecodado_ nas lojas de aplicativos usando IA. E ainda seguindo o que ele diz:

> A IA só reflete quem você é

Por isso acredito que o trabalho sujo e chato, ao meu ver, deve ser sim feito com a IA, assim como fiz com os testes desse projeto.

No entanto tenho o conhecimento necessário para saber o que pedir, como pedir e principalmente: **revisar e aprovar**

Por outro lado a IA é uma grande ferramenta para nós desenvolvedores para acelerar debugs, fixes, pair-programming e de estudo para entendermos conceitos complexos com uma linguagem mais próxima do nosso entendimento.

Dentro da empresa para que isso não se torne uma aberração fora de controle e virar um simples aprovador de código é essencial que a cultura de _codar_, treinar, testar e revisar permaneça viva em todos os níveis de todas as áreas porque afinal: Está cada vez mais fácil culpar o "sistema".
