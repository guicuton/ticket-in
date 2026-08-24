# Design — Build e deploy em Docker

## Objetivo

Um `docker compose up` entrega a aplicação de pé e pronta para uso: banco migrado
e populado, backend NestJS servido por `pm2-runtime` e a SPA Angular servida por
nginx, com a API acessível pelo mesmo host e porta da SPA.

Um segundo fluxo, de desenvolvimento, sobe apenas as dependências de
infraestrutura em containers e mantém backend e frontend rodando na máquina com
hot reload.

## Estado atual e problemas conhecidos

O repositório é um monorepo de workspaces npm com `backend` (NestJS) e `frontend`
(Angular), compartilhando um único `package-lock.json` na raiz.

Quatro pontos do estado atual bloqueiam o build e são corrigidos por este design:

1. `POSTGRES_DATABASE_URL` no `.env` usa interpolação (`@${POSTGRES_DB}`) que nem
   o `dotenv` nem o `env_file` do compose expandem, aponta o host para o nome do
   banco e exige `sslmode=require`, que o Postgres do compose não oferece.
2. O script `migration:create` da raiz chama `prisma migrate prod`, comando que
   não existe. As migrations reais estão em `backend/libs/database/migrations`
   (três migrations e o `migration_lock.toml`) e são aplicadas com
   `prisma migrate deploy`.
3. `workspaces` na raiz declara `"infra"`, mas o diretório não existe — `npm ci`
   em container limpo falha.
4. O `Dockerfile` presente na raiz pertence a outro projeto: referencia
   `/home/dashboard-nestjs`, um script `build:prod` inexistente e um caminho de
   schema Prisma que não corresponde a este repositório. Ele é substituído.

## Arquitetura

### Imagens

Um único `Dockerfile` na raiz, multi-stage, com o contexto na raiz do
repositório — obrigatório, porque o `package-lock.json` que descreve os dois
workspaces vive lá.

| Stage        | Base                   | Responsabilidade |
|--------------|------------------------|------------------|
| `deps`       | `node:24.19.0-alpine`  | Instala `npm@12.0.2` (o `allowScripts` da raiz é um recurso do npm 12) e o toolchain `python3 make g++`, necessário porque o `bcrypt` tem binding nativo e pode não ter prebuild para musl. Copia apenas os manifests e roda `npm ci`. |
| `build`      | `deps`                 | Copia o código e roda `nest build` e `ng build`. |
| `migrator`   | `build`                | Imagem usada pelos services `migration` e `seed`. Precisa das devDependencies porque o Prisma CLI e o `tsx` (usado pelo seed) vivem lá. |
| `prod-deps`  | `deps`                 | `npm ci --omit=dev` para o workspace `backend` mais a raiz. Recompila o `bcrypt`, por isso herda de `deps` e não de uma base limpa. |
| `backend`    | `node:24.19.0-alpine`  | Runtime. Recebe `node_modules` de `prod-deps`, `backend/dist` de `build`, `pm2` global e o ecosystem. |
| `frontend`   | `nginx:1.27-alpine`    | Estáticos de `frontend/dist/browser` mais o `default.conf`. |

O `backend/dist/main.js` é um bundle webpack: as importações relativas — incluindo
o Prisma Client gerado em `libs/database/prisma/generated` — entram no bundle, e o
`webpack-node-externals` mantém apenas os pacotes de `node_modules` externos.
Por isso a imagem de runtime precisa de `dist` e `node_modules`, e de mais nada.

### Services do compose de produção

Todos na network `ticketin`, comunicando-se por nome de container.

```
postgres (healthy) ─┐
                    ├─> migration (migrate deploy) ─> seed ─> backend ─> frontend
redis (healthy) ────┘
```

| Service    | Container            | Notas |
|------------|----------------------|-------|
| `postgres` | `ticketin_postgres`  | `postgres:16-alpine`, volume `postgres_data`, healthcheck `pg_isready -U $POSTGRES_USER`. Não publica porta. |
| `redis`    | `ticketin_redis`     | Mantém a configuração de runtime já existente no compose atual. Não publica porta. |
| `migration`| `ticketin_migration` | Target `migrator`, roda `npm run migration:deploy`. Depende de `postgres` saudável. |
| `seed`     | `ticketin_seed`      | Target `migrator`, roda `npm run migration:seed`. Depende de `migration` concluída. Roda em toda subida: o seed faz `upsert` por `username`, então é idempotente. |
| `backend`  | `ticketin_backend`   | Target `backend`, `pm2-runtime`. Depende de `seed` concluída e `redis` saudável. Não publica porta. |
| `frontend` | `ticketin_frontend`  | Target `frontend`, publica `80:80`. Única porta exposta ao host. |

### Roteamento no nginx

A SPA chama caminhos relativos sob `/api/v1` (`frontend/src/environments/environments.ts`)
e, em desenvolvimento, o `proxy.conf.mjs` reescreve `^/api/v1` para `/`. O backend
não tem prefixo global, então o nginx precisa fazer o mesmo strip:

- `location /api/v1/` → `proxy_pass http://ticketin_backend:3000/;` — a barra
  final no destino é o que remove o prefixo.
- `location /` → `try_files $uri $uri/ /index.html;` — fallback de SPA para o
  roteador do Angular.

O Swagger não é exposto em produção. Ele permanece disponível no fluxo de
desenvolvimento em `localhost:3000/docs`.

### Configuração do pm2

`infra/pm2/ecosystem.config.js`, em modo cluster, com o número de instâncias lido
de `PM2_INSTANCES` (default `2`). Modo cluster preserva o `enableShutdownHooks()`
do Nest e permite escalar sem rebuild da imagem.

### Variáveis de ambiente

`.env.example` versionado na raiz documenta os valores de desenvolvimento; o
`.env` real continua fora do versionamento. O compose declara todas as variáveis
em `environment:` com defaults inline (`${POSTGRES_USER:-postgres}`), de modo que
`docker compose up` funciona em um clone limpo, sem `.env`.

O container do backend não lê arquivo `.env`: recebe tudo por `environment`. O
`ConfigModule` do Nest tolera `envFilePath` inexistente e lê de `process.env`.

`POSTGRES_DATABASE_URL` é montado no próprio compose — onde a interpolação
realmente acontece — apontando para o container:

```
postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@ticketin_postgres:5432/${POSTGRES_DB}
```

No `.env.example` a mesma variável aparece como string literal apontando para
`localhost`, sem `${...}` e sem `sslmode`.

| Variável                 | Dev (`.env`)   | Container            |
|--------------------------|----------------|----------------------|
| `APP_PORT`               | `3000`         | `3000`               |
| `POSTGRES_USER`          | `postgres`     | idem                 |
| `POSTGRES_PASSWORD`      | `postgres`     | idem                 |
| `POSTGRES_DB`            | `app`          | idem                 |
| `POSTGRES_DATABASE_URL`  | `localhost`    | `ticketin_postgres`  |
| `REDIS_HOST`             | `localhost`    | `ticketin_redis`     |
| `REDIS_PORT`             | `6379`         | idem                 |
| `REDIS_PASS`             | `12345`        | idem                 |
| `JWT_SECRET`             | `ABC1234`      | idem                 |
| `PM2_INSTANCES`          | —              | `2`                  |

### Fluxo de desenvolvimento

`docker-compose.dev.yml` sobe apenas `postgres` e `redis`, com portas publicadas
no host e nomes de container sufixados com `_dev` para não colidirem com a stack
de produção. Os scripts da raiz encadeiam o fluxo:

```
dev              → services:up && migration:deploy && start:dev
services:up      → docker compose -f docker-compose.dev.yml up -d --wait
services:down    → docker compose -f docker-compose.dev.yml down
prod:up          → docker compose up --build -d
prod:down        → docker compose down
prod:logs        → docker compose logs -f
build            → build:backend && build:frontend
migration:deploy → prisma migrate deploy (substitui o "migrate prod" quebrado)
migration:create → prisma migrate dev (criação de novas migrations)
```

A flag `--wait` do compose aguarda os healthchecks, o que dispensa um script
próprio de espera pelo Postgres.

## Inventário de arquivos

Novos:

- `Dockerfile` — substitui integralmente o arquivo atual, que é de outro projeto.
- `.dockerignore` — exclui `node_modules`, `dist`, `.angular`, `.git`, `coverage`, `.env`.
- `docker-compose.dev.yml`
- `.env.example`
- `infra/package.json` — pacote privado e vazio, apenas para satisfazer a entrada
  `"infra"` já declarada em `workspaces`.
- `infra/nginx/default.conf`
- `infra/pm2/ecosystem.config.js`

Alterados:

- `docker-compose.yml` — reescrito com os seis services acima.
- `package.json` (raiz) — scripts novos e correção do `migration:create`.
- `angular.json` — `outputPath` fixado em `dist`, tornando o caminho de cópia
  `frontend/dist/browser` estável e independente do nome do projeto.
- `.env` — `POSTGRES_DATABASE_URL` corrigido para uso local e `APP_PORT` acrescentado.
- `readme.md` — instruções de subida.

## Verificação

1. `docker compose up --build` sobe a stack e os services `migration` e `seed`
   terminam com código 0.
2. `curl -I localhost/` devolve 200 com o `index.html` da SPA.
3. `curl -X POST localhost/api/v1/accounts/authentication` com `admin` / `123456`
   (credenciais do seed) devolve um JWT.
4. Uma rota interna do Angular recarregada direto no navegador devolve a SPA, e
   não 404 — confirmando o `try_files`.
5. `docker compose down && docker compose up -d` sobe de novo sem erro,
   confirmando a idempotência do `migrate deploy` e do seed.
6. `npm run dev` sobe Postgres e Redis em container, aplica as migrations e
   inicia backend e frontend locais.

## Riscos

- `npm ci --omit=dev` com filtro de workspace tem histórico de comportamento
  instável entre versões do npm. Se o filtro não isolar o `backend`, o fallback é
  um `npm ci --omit=dev` sem filtro, que instala também as dependências de runtime
  do Angular na imagem — desperdício aceitável, sem impacto funcional.
- O `bcrypt` compila a partir do fonte no stage `deps`, o que torna o primeiro
  build sensivelmente mais lento. Builds seguintes reaproveitam a camada.
- O Prisma Client é gerado com o generator `prisma-client` e driver adapter
  `@prisma/adapter-pg`, portanto não depende de engine binário. Isso é premissa
  do design e é confirmado pelo passo 3 da verificação.

## Fora de escopo

Firewall, rate limit, TLS, hardening de imagem, orquestração multi-host,
observabilidade e pipeline de CI.
