# Build e Deploy em Docker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que `docker compose up` entregue a aplicação completa de pé — banco migrado e populado, backend NestJS sob `pm2-runtime` e a SPA Angular servida por nginx na porta 80 — e que `npm run dev` suba as dependências em container mantendo backend e frontend locais com hot reload.

**Architecture:** Um `Dockerfile` multi-stage na raiz (contexto na raiz, porque o `package-lock.json` dos workspaces vive lá) produz três imagens a partir de um único `npm ci`: `migrator` (Prisma CLI e seed), `backend` (runtime com pm2) e `frontend` (nginx com os estáticos). O `docker-compose.yml` encadeia seis services por healthcheck e conclusão, e o nginx faz o strip de `/api/v1` que hoje o `proxy.conf.mjs` faz em desenvolvimento.

**Tech Stack:** Docker multi-stage, docker compose v2, Node 24.19.0 alpine, npm workspaces, NestJS 11 com build webpack, Prisma 7 com driver adapter `@prisma/adapter-pg`, Angular 22 (`@angular/build:application`), nginx 1.27 alpine, pm2 em modo cluster, PostgreSQL 16, Redis 7.

**Spec:** `docs/plans/docker-deploy-design.md`

## Global Constraints

- Nenhum commit pode conter linha de coautoria ou atribuição a IA.
- Nenhum `git pull`, `git fetch` ou qualquer operação que traga dados do remoto.
- Versões fixadas exatamente: `node:24.19.0-alpine`, `npm@12.0.2`, `nginx:1.27-alpine`, `postgres:16-alpine`, `redis:7.0.8-alpine`.
- A única porta publicada no host pela stack de produção é `80`, pelo service `frontend`.
- Dentro do compose os services se comunicam por nome de container: `ticketin_postgres`, `ticketin_redis`, `ticketin_backend`.
- Toda variável de ambiente no compose usa default inline (`${VAR:-default}`), de modo que `docker compose up` funcione sem arquivo `.env`.
- O Swagger não é exposto em produção.
- Cada task termina com um commit próprio.

---

### Task 1: Workspace `infra` e arquivos de ambiente

Cria o diretório `infra/` como workspace npm de verdade — hoje `"infra"` está declarado em `workspaces` sem existir no disco, o que quebra `npm ci` em container limpo — e acerta as variáveis de ambiente.

**Files:**
- Create: `infra/package.json`
- Create: `.env.example`
- Modify: `.env`
- Modify: `package-lock.json` (regenerado pelo npm)

**Interfaces:**
- Consumes: nada.
- Produces: workspace `infra` resolvível por `npm ls -w infra`; variáveis `APP_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`, `JWT_SECRET` documentadas em `.env.example`.

- [ ] **Step 1: Verificar que o workspace `infra` está quebrado hoje**

```bash
npm ls -w infra
```

Esperado: erro dizendo que o workspace não foi encontrado (`No workspaces found` ou equivalente). Isso confirma o problema que a task resolve.

- [ ] **Step 2: Criar `infra/package.json`**

Pacote privado e sem dependências. Ele existe só para satisfazer a entrada `"infra"` já presente em `workspaces` na raiz.

```json
{
  "name": "infra",
  "version": "1.0.0",
  "private": true,
  "description": "Arquivos de configuracao de infraestrutura (nginx, pm2)",
  "license": "UNLICENSED"
}
```

- [ ] **Step 3: Registrar o workspace no lockfile**

```bash
npm install --package-lock-only
```

- [ ] **Step 4: Verificar que o workspace agora resolve**

```bash
npm ls -w infra
```

Esperado: saída sem erro, listando `infra@1.0.0`.

- [ ] **Step 5: Criar `.env.example`**

Valores de desenvolvimento, apontando para `localhost`. Note que `POSTGRES_DATABASE_URL` é uma string literal: nem o `dotenv` nem o `env_file` do compose expandem `${...}` dentro de um arquivo de env, e é por isso que a URL atual está quebrada.

```
# APP
APP_PORT=3000

# DATABASE
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="app"
POSTGRES_PORT=5432
POSTGRES_DATABASE_URL="postgres://postgres:postgres@localhost:5432/app"

# REDIS
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASS=12345

# JWT
JWT_SECRET="ABC1234"
```

- [ ] **Step 6: Corrigir o `.env` local**

Substituir o conteúdo de `.env` pelo mesmo conteúdo do `.env.example`. O `.env` atual tem três defeitos: usa `${POSTGRES_USER}` e `${POSTGRES_DB}` que não são expandidos, aponta o host do banco para o nome do banco, e pede `sslmode=require` de um Postgres sem TLS. `.env` continua fora do versionamento.

- [ ] **Step 7: Verificar que a URL do banco agora é utilizável**

```bash
node -e "require('dotenv').config(); const u=new URL(process.env.POSTGRES_DATABASE_URL); console.log(u.hostname, u.port, u.pathname, u.searchParams.toString())"
```

Esperado: `localhost 5432 /app ` — hostname `localhost`, sem `sslmode`.

- [ ] **Step 8: Commit**

```bash
git add infra/package.json .env.example package.json package-lock.json
git commit -m "chore(infra): criar workspace infra e arquivo de envs de exemplo"
```

---

### Task 2: Compose de desenvolvimento

Sobe apenas Postgres e Redis em container, com portas publicadas no host, para o fluxo de desenvolvimento local. Nomes de container e projeto sufixados com `_dev` para não colidirem com a stack de produção.

**Files:**
- Create: `docker-compose.dev.yml`

**Interfaces:**
- Consumes: variáveis de `.env` da Task 1.
- Produces: containers `ticketin_postgres_dev` (porta 5432) e `ticketin_redis_dev` (porta 6379), ambos com healthcheck, consumidos pelo script `services:up` da Task 3.

- [ ] **Step 1: Criar `docker-compose.dev.yml`**

```yaml
name: ticketin_dev

networks:
  ticketin_dev:
    name: ticketin_dev

volumes:
  postgres_data_dev:
  redis_data_dev:

services:
  postgres:
    image: postgres:16-alpine
    container_name: ticketin_postgres_dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-app}
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    networks:
      - ticketin_dev
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-app}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7.0.8-alpine
    container_name: ticketin_redis_dev
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASS:-12345} --appendonly yes
    volumes:
      - redis_data_dev:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    networks:
      - ticketin_dev
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASS:-12345} ping | grep -q PONG"]
      interval: 5s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Validar a sintaxe do compose**

```bash
docker compose -f docker-compose.dev.yml config
```

Esperado: o YAML resolvido é impresso, sem erro. Confirme que `POSTGRES_DB` aparece como `app` e que as portas `5432` e `6379` estão publicadas.

- [ ] **Step 3: Subir e aguardar os healthchecks**

```bash
docker compose -f docker-compose.dev.yml up -d --wait
```

Esperado: exit 0. A flag `--wait` só retorna quando os dois healthchecks passam, o que dispensa qualquer script de espera pelo Postgres.

- [ ] **Step 4: Verificar que os dois serviços respondem**

```bash
docker exec ticketin_postgres_dev pg_isready -U postgres -d app
docker exec ticketin_redis_dev redis-cli -a 12345 ping
```

Esperado: `accepting connections` e `PONG`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat(infra): compose de desenvolvimento com postgres e redis"
```

---

### Task 3: Scripts npm da raiz

Reescreve os scripts da raiz para cobrir desenvolvimento, build e produção, e corrige os dois comandos Prisma quebrados. Também remove o bloco `"prisma"` legado do `package.json`.

**Files:**
- Modify: `package.json` (raiz)

**Interfaces:**
- Consumes: `docker-compose.dev.yml` da Task 2.
- Produces: os scripts `prisma:generate`, `build:backend`, `build:frontend`, `build`, `migration:deploy`, `migration:create`, `migration:seed`, `services:up`, `services:stop`, `services:down`, `prod:up`, `prod:down`, `prod:logs`, `dev`. As Tasks 5 a 8 chamam `build:backend`, `build:frontend`, `prisma:generate`, `migration:deploy` e `migration:seed` de dentro dos containers.

- [ ] **Step 1: Confirmar que o script de migration está quebrado hoje**

```bash
npm run migration:create
```

Esperado: falha — `prisma migrate prod` não é um comando válido do Prisma CLI. Isso confirma o defeito que a task corrige.

- [ ] **Step 2: Substituir o bloco `scripts` do `package.json` da raiz**

```json
  "scripts": {
    "dev": "npm run services:up && npm run migration:deploy && npm run start:dev",
    "start:dev": "concurrently -c blue,green \"npm run start:dev:*\"",
    "start:dev:backend": "npm run start:dev --workspace=backend",
    "start:dev:frontend": "npm run start --workspace=frontend",
    "build": "npm run prisma:generate && npm run build:backend && npm run build:frontend",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "services:up": "docker compose -f docker-compose.dev.yml up -d --wait",
    "services:stop": "docker compose -f docker-compose.dev.yml stop",
    "services:down": "docker compose -f docker-compose.dev.yml down",
    "prod:up": "docker compose up --build -d",
    "prod:down": "docker compose down",
    "prod:logs": "docker compose logs -f",
    "prisma:generate": "prisma generate --schema=backend/libs/database/prisma/schema.prisma --config backend/libs/database/prisma.config.ts",
    "migration:deploy": "prisma migrate deploy --schema=backend/libs/database/prisma/schema.prisma --config backend/libs/database/prisma.config.ts",
    "migration:create": "prisma migrate dev --schema=backend/libs/database/prisma/schema.prisma --config backend/libs/database/prisma.config.ts",
    "migration:seed": "prisma db seed --schema=backend/libs/database/prisma/schema.prisma --config backend/libs/database/prisma.config.ts"
  },
```

- [ ] **Step 3: Remover o bloco `"prisma"` legado do `package.json` da raiz**

Apagar por completo estas linhas:

```json
  "prisma": {
    "seed": "npm run migration:seed"
  },
```

Motivo: o comando de seed já está declarado em `backend/libs/database/prisma.config.ts` (`migrations.seed`), que no Prisma 7 tem precedência. Manter os dois é redundante e, se a precedência mudar, `prisma db seed` chamaria `npm run migration:seed`, que chama `prisma db seed` — recursão infinita.

- [ ] **Step 4: Verificar que o `migration:deploy` aplica as migrations**

Com o compose de desenvolvimento no ar (Task 2):

```bash
npm run migration:deploy
```

Esperado: exit 0, com as três migrations aplicadas — `20260819155301_initial_migration`, `20260820161055_area_indexes`, `20260820161341_new_indexes`.

- [ ] **Step 5: Verificar que o seed roda e termina**

```bash
npm run migration:seed
```

Esperado: exit 0 e o processo **encerra** — `backend/configuration/seed.ts` chama `database.$disconnect()` no final. Um seed que não encerra travaria o service `seed` do compose e o backend nunca subiria.

- [ ] **Step 6: Verificar as três contas criadas pelo seed**

```bash
docker exec ticketin_postgres_dev psql -U postgres -d app -c "select username, role from logins order by username"
```

Esperado: três linhas — `admin` (ADMIN), `support` (MASTER), `user` (USER).

- [ ] **Step 7: Verificar a idempotência do seed**

```bash
npm run migration:seed
docker exec ticketin_postgres_dev psql -U postgres -d app -c "select count(*) from logins"
```

Esperado: exit 0 e `count` continua `3`. O seed usa `upsert` por `username`, e é isso que permite rodá-lo em toda subida do compose de produção.

- [ ] **Step 8: Commit**

```bash
git add package.json
git commit -m "chore(scripts): scripts de dev, build e producao e correcao dos comandos prisma"
```

---

### Task 4: Caminho de saída do build do Angular

Fixa o `outputPath` do build do frontend para que o `COPY` do estágio nginx aponte para um caminho estável, que não muda se o projeto for renomeado.

**Files:**
- Modify: `frontend/angular.json`

**Interfaces:**
- Consumes: nada.
- Produces: o build do frontend passa a escrever em `frontend/dist/browser`, caminho consumido pelo estágio `frontend` do Dockerfile na Task 7.

- [ ] **Step 1: Observar o caminho implícito de hoje**

```bash
npm run build:frontend
ls frontend/dist
```

Esperado: existe `frontend/dist/frontend/browser` — o padrão implícito `dist/<nome-do-projeto>/browser` do `@angular/build:application`.

- [ ] **Step 2: Adicionar `outputPath` em `frontend/angular.json`**

Dentro de `projects.frontend.architect.build.options`, acrescentar a chave como primeira entrada do objeto:

```json
          "options": {
            "outputPath": "dist",
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
```

O restante de `options` fica inalterado.

- [ ] **Step 3: Rebuild a partir de um dist limpo**

```bash
rm -rf frontend/dist
npm run build:frontend
```

- [ ] **Step 4: Verificar o novo caminho**

```bash
ls frontend/dist/browser/index.html
```

Esperado: o arquivo existe. Não deve mais existir `frontend/dist/frontend`.

- [ ] **Step 5: Commit**

```bash
git add frontend/angular.json
git commit -m "chore(frontend): fixar outputPath do build em dist"
```

---

### Task 5: `.dockerignore` e os estágios de dependências e build

Primeira metade do Dockerfile: instalação de dependências e compilação dos dois workspaces. O `Dockerfile` atual é de outro projeto (`/home/dashboard-nestjs`, script `build:prod` inexistente, caminho de schema errado) e é substituído por completo.

**Files:**
- Create: `.dockerignore`
- Modify: `Dockerfile` (substituição integral do conteúdo)

**Interfaces:**
- Consumes: scripts `prisma:generate`, `build:backend` e `build:frontend` da Task 3; `infra/package.json` da Task 1; `outputPath` da Task 4.
- Produces: estágios `deps` (com `node_modules` completo em `/app`) e `build` (com `/app/backend/dist/main.js` e `/app/frontend/dist/browser`), consumidos pelas Tasks 6 e 7.

- [ ] **Step 1: Criar `.dockerignore`**

A exclusão de `**/prisma/generated` é deliberada: o Prisma Client é ignorado por `backend/.gitignore`, não é versionado, e mantê-lo fora do contexto obriga o build a gerá-lo do `schema.prisma`, tornando a imagem imune a um client desatualizado na máquina de quem builda.

```
node_modules
**/node_modules

dist
**/dist

.angular
**/.angular

**/prisma/generated

.git
.gitignore

coverage
**/coverage

.env
.env.*

docs
.claude
.vscode
**/.vscode
```

- [ ] **Step 2: Escrever os dois primeiros estágios do `Dockerfile`**

Substituir todo o conteúdo atual do arquivo por:

```dockerfile
# syntax=docker/dockerfile:1

#############################################
# deps - dependencias completas do monorepo #
#############################################
FROM node:24.19.0-alpine AS deps

# python3/make/g++ sao necessarios porque bcrypt tem binding nativo e pode nao
# ter prebuild para musl. npm@12 e necessario porque o campo allowScripts do
# package.json da raiz e um recurso dessa versao.
RUN apk add --no-cache python3 make g++ \
    && npm install -g npm@12.0.2

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY infra/package.json infra/package.json

RUN npm ci

##########################################
# build - compila backend e frontend     #
##########################################
FROM deps AS build

WORKDIR /app

COPY . .

# prisma.config.ts resolve env('POSTGRES_DATABASE_URL') no carregamento do
# config, entao ate o generate exige a variavel. Este valor e ficticio, nada
# conecta em banco neste estagio e ele nao chega a nenhuma imagem de runtime.
ENV POSTGRES_DATABASE_URL="postgres://build:build@127.0.0.1:5432/build"

RUN npm run prisma:generate \
    && npm run build:backend \
    && npm run build:frontend
```

- [ ] **Step 3: Buildar o estágio `deps`**

```bash
docker build --target deps -t ticketin-deps .
```

Esperado: exit 0. Este é o passo mais lento do plano, porque o `bcrypt` compila a partir do fonte.

- [ ] **Step 4: Verificar que o `bcrypt` compilou**

```bash
docker run --rm ticketin-deps node -e "require('bcrypt'); console.log('bcrypt ok')"
```

Esperado: `bcrypt ok`. Se falhar com erro de binding nativo, o toolchain do estágio `deps` não fez efeito.

- [ ] **Step 5: Buildar o estágio `build`**

```bash
docker build --target build -t ticketin-build .
```

Esperado: exit 0, com o `prisma generate` reportando o client gerado antes dos dois builds.

- [ ] **Step 6: Verificar os dois artefatos de build**

```bash
docker run --rm ticketin-build ls -l /app/backend/dist/main.js /app/frontend/dist/browser/index.html
```

Esperado: os dois arquivos existem.

- [ ] **Step 7: Commit**

```bash
git add .dockerignore Dockerfile
git commit -m "feat(docker): estagios de dependencias e build do monorepo"
```

---

### Task 6: Imagem de runtime do backend e configuração do pm2

Segunda parte do Dockerfile: o estágio `migrator`, o estágio de dependências de produção e a imagem final do backend rodando sob `pm2-runtime` em modo cluster.

**Files:**
- Create: `infra/pm2/ecosystem.config.js`
- Modify: `Dockerfile` (acrescentar três estágios ao final)

**Interfaces:**
- Consumes: estágios `deps` e `build` da Task 5.
- Produces: estágios `migrator` (Prisma CLI, `tsx` e código-fonte disponíveis em `/app`), `prod-deps` e `backend` (escuta em `3000`, `CMD` sob `pm2-runtime`), consumidos pelo compose da Task 8.

- [ ] **Step 1: Criar `infra/pm2/ecosystem.config.js`**

Arquivo `.js` e não `.json` porque o número de instâncias é lido de variável de ambiente. Modo cluster preserva o `enableShutdownHooks()` do Nest.

```javascript
const instances = Number(process.env.PM2_INSTANCES) || 2;

module.exports = {
  apps: [
    {
      name: 'ticketin-backend',
      cwd: '/app',
      script: 'backend/dist/main.js',
      exec_mode: 'cluster',
      instances,
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      merge_logs: true,
      time: true,
    },
  ],
};
```

- [ ] **Step 2: Acrescentar os três estágios ao final do `Dockerfile`**

```dockerfile
#############################################
# migrator - imagem de migrations e seed    #
#############################################
FROM build AS migrator

WORKDIR /app

CMD ["npm", "run", "migration:deploy"]

#############################################
# prod-deps - dependencias de producao      #
#############################################
FROM deps AS prod-deps

WORKDIR /app

# os manifests dos workspaces ja vieram do estagio deps
RUN npm ci --omit=dev --workspace=backend --include-workspace-root

#############################################
# backend - runtime sob pm2                 #
#############################################
FROM node:24.19.0-alpine AS backend

RUN npm install -g pm2

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY infra/pm2/ecosystem.config.js ./infra/pm2/ecosystem.config.js

ENV NODE_ENV=production
ENV APP_PORT=3000

EXPOSE 3000

CMD ["pm2-runtime", "start", "infra/pm2/ecosystem.config.js"]
```

O `main.js` é um bundle webpack: as importações relativas, incluindo o Prisma Client gerado, já estão dentro dele, e o `webpack-node-externals` deixa externos apenas os pacotes de `node_modules`. Por isso a imagem final precisa só de `node_modules` e `backend/dist`.

- [ ] **Step 3: Buildar o estágio `backend`**

```bash
docker build --target backend -t ticketin-backend .
```

Esperado: exit 0.

Se o `npm ci --omit=dev --workspace=backend --include-workspace-root` falhar ou não isolar o workspace, o fallback é trocar essa linha por `RUN npm ci --omit=dev`, que instala as dependências de produção de todos os workspaces. A imagem fica maior, sem impacto funcional.

- [ ] **Step 4: Verificar que a imagem não carrega devDependencies**

```bash
docker run --rm ticketin-backend sh -c "test ! -d node_modules/@nestjs/cli && echo 'sem devDependencies'"
```

Esperado: `sem devDependencies`.

- [ ] **Step 5: Subir o backend contra o Postgres e o Redis de desenvolvimento**

Com o compose de desenvolvimento no ar e as migrations já aplicadas (Tasks 2 e 3):

```bash
docker run --rm -d --name ticketin_backend_probe \
  --network ticketin_dev \
  -e POSTGRES_DATABASE_URL="postgres://postgres:postgres@ticketin_postgres_dev:5432/app" \
  -e REDIS_HOST=ticketin_redis_dev \
  -e REDIS_PORT=6379 \
  -e REDIS_PASS=12345 \
  -e JWT_SECRET=ABC1234 \
  -e PM2_INSTANCES=2 \
  -p 3010:3000 \
  ticketin-backend
```

- [ ] **Step 6: Verificar que as duas instâncias do cluster subiram**

```bash
docker exec ticketin_backend_probe pm2 list
```

Esperado: duas linhas `ticketin-backend` com status `online` e modo `cluster`.

- [ ] **Step 7: Verificar que a API responde e fala com o banco**

```bash
curl -s -X POST http://localhost:3010/accounts/authentication \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

Esperado: JSON com um token JWT. Isso exercita, em um único passo, o bundle webpack, o Prisma Client gerado no build, o driver adapter `@prisma/adapter-pg` e o `bcrypt` nativo.

- [ ] **Step 8: Derrubar o container de teste**

```bash
docker rm -f ticketin_backend_probe
```

- [ ] **Step 9: Commit**

```bash
git add Dockerfile infra/pm2/ecosystem.config.js
git commit -m "feat(docker): imagem de runtime do backend com pm2 em modo cluster"
```

---

### Task 7: Imagem do nginx e roteamento da SPA

Estágio final do Dockerfile e a configuração do nginx, que serve os estáticos do Angular, faz o fallback de rotas da SPA e repassa `/api/v1` ao backend removendo o prefixo.

**Files:**
- Create: `infra/nginx/default.conf`
- Modify: `Dockerfile` (acrescentar o estágio `frontend` ao final)

**Interfaces:**
- Consumes: estágio `build` da Task 5 e o `outputPath` da Task 4 (`/app/frontend/dist/browser`).
- Produces: estágio `frontend`, que escuta em `80` e faz proxy para `http://ticketin_backend:3000`, consumido pelo compose da Task 8.

- [ ] **Step 1: Criar `infra/nginx/default.conf`**

A barra final em `proxy_pass http://ticketin_backend:3000/;` é o que remove o prefixo `/api/v1` — sem ela o backend receberia `/api/v1/accounts/...` e devolveria 404, porque ele não tem prefixo global. Isso espelha o `pathRewrite` de `frontend/src/proxy.conf.mjs`, usado em desenvolvimento.

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # acompanha o limite de 5mb do body parser configurado em backend/src/main.ts
    client_max_body_size 5m;

    gzip on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/v1/ {
        proxy_pass http://ticketin_backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Acrescentar o estágio `frontend` ao final do `Dockerfile`**

```dockerfile
#############################################
# frontend - SPA servida por nginx          #
#############################################
FROM nginx:1.27-alpine AS frontend

COPY --from=build /app/frontend/dist/browser /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

- [ ] **Step 3: Buildar o estágio `frontend`**

```bash
docker build --target frontend -t ticketin-frontend .
```

Esperado: exit 0.

- [ ] **Step 4: Verificar que a configuração do nginx é válida**

```bash
docker run --rm ticketin-frontend nginx -t
```

Esperado: `syntax is ok` e `test is successful`.

- [ ] **Step 5: Verificar que os estáticos foram copiados**

```bash
docker run --rm ticketin-frontend ls /usr/share/nginx/html/index.html
```

Esperado: o arquivo existe. Se falhar, o `outputPath` da Task 4 não está valendo.

- [ ] **Step 6: Subir o nginx junto do backend e testar o strip do prefixo**

```bash
docker run --rm -d --name ticketin_backend_probe \
  --network ticketin_dev --network-alias ticketin_backend \
  -e POSTGRES_DATABASE_URL="postgres://postgres:postgres@ticketin_postgres_dev:5432/app" \
  -e REDIS_HOST=ticketin_redis_dev \
  -e REDIS_PORT=6379 \
  -e REDIS_PASS=12345 \
  -e JWT_SECRET=ABC1234 \
  ticketin-backend

docker run --rm -d --name ticketin_frontend_probe \
  --network ticketin_dev -p 8081:80 \
  ticketin-frontend
```

O `--network-alias ticketin_backend` é o que faz o nome usado no `proxy_pass` resolver fora do compose.

- [ ] **Step 7: Verificar a SPA, o fallback de rotas e o proxy da API**

```bash
curl -s -o /dev/null -w "raiz:%{http_code}\n" http://localhost:8081/
curl -s -o /dev/null -w "rota-spa:%{http_code}\n" http://localhost:8081/accounts
curl -s -X POST http://localhost:8081/api/v1/accounts/authentication \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

Esperado: `raiz:200`, `rota-spa:200` (o `try_files` devolve o `index.html` em vez de 404) e um JSON com token JWT no terceiro comando, provando que o prefixo `/api/v1` foi removido antes de chegar ao backend.

- [ ] **Step 8: Derrubar os containers de teste**

```bash
docker rm -f ticketin_backend_probe ticketin_frontend_probe
```

- [ ] **Step 9: Commit**

```bash
git add Dockerfile infra/nginx/default.conf
git commit -m "feat(docker): imagem nginx servindo a spa e repassando /api/v1"
```

---

### Task 8: Compose de produção

Reescreve o `docker-compose.yml` com os seis services encadeados. O arquivo atual tem o backend comentado, aponta para um `env_file` inexistente (`configurations/envs/.env.prod`) e usa o script de migration quebrado.

**Files:**
- Modify: `docker-compose.yml` (substituição integral do conteúdo)

**Interfaces:**
- Consumes: todos os estágios do Dockerfile (Tasks 5, 6 e 7) e os scripts `migration:deploy` e `migration:seed` da Task 3.
- Produces: a stack completa em `docker compose up`, publicando apenas a porta `80`.

- [ ] **Step 1: Substituir todo o conteúdo de `docker-compose.yml`**

```yaml
name: ticketin

networks:
  ticketin:
    name: ticketin

volumes:
  postgres_data:
  redis_data:

x-database-url: &database-url
  POSTGRES_DATABASE_URL: postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@ticketin_postgres:5432/${POSTGRES_DB:-app}

services:
  postgres:
    image: postgres:16-alpine
    container_name: ticketin_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-app}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ticketin
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-app}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7.0.8-alpine
    container_name: ticketin_redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASS:-12345}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 1gb
      --maxmemory-policy allkeys-lru
      --save 300 100
    volumes:
      - redis_data:/data
    networks:
      - ticketin
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASS:-12345} ping | grep -q PONG"]
      interval: 5s
      timeout: 5s
      retries: 10

  migration:
    container_name: ticketin_migration
    build:
      context: .
      target: migrator
    command: ["npm", "run", "migration:deploy"]
    environment:
      <<: *database-url
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - ticketin
    restart: "no"

  seed:
    container_name: ticketin_seed
    build:
      context: .
      target: migrator
    command: ["npm", "run", "migration:seed"]
    environment:
      <<: *database-url
      NODE_ENV: production
    depends_on:
      migration:
        condition: service_completed_successfully
    networks:
      - ticketin
    restart: "no"

  backend:
    container_name: ticketin_backend
    build:
      context: .
      target: backend
    environment:
      <<: *database-url
      NODE_ENV: production
      APP_PORT: 3000
      PM2_INSTANCES: ${PM2_INSTANCES:-2}
      REDIS_HOST: ticketin_redis
      REDIS_PORT: 6379
      REDIS_PASS: ${REDIS_PASS:-12345}
      JWT_SECRET: ${JWT_SECRET:-ABC1234}
    depends_on:
      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
    networks:
      - ticketin
    restart: unless-stopped

  frontend:
    container_name: ticketin_frontend
    build:
      context: .
      target: frontend
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_started
    networks:
      - ticketin
    restart: unless-stopped
```

Postgres e Redis não publicam portas: dentro da network eles são alcançados por nome de container, e a única porta exposta ao host é a `80` do nginx. O `depends_on` do `frontend` importa porque o nginx resolve `ticketin_backend` ao carregar a configuração — se o container não existisse, ele abortaria com `host not found in upstream`.

- [ ] **Step 2: Validar a interpolação do compose sem `.env`**

```bash
: > .empty.env
docker compose --env-file .empty.env config | grep POSTGRES_DATABASE_URL
rm .empty.env
```

Esperado: `postgres://postgres:postgres@ticketin_postgres:5432/app`. Isso prova que os defaults inline funcionam em um clone sem `.env`. O arquivo vazio é usado em vez de `/dev/null` porque o caminho não é portável no Windows.

- [ ] **Step 3: Subir a stack completa do zero**

```bash
docker compose down -v
docker compose up --build -d
```

Esperado: exit 0, com os seis services criados.

- [ ] **Step 4: Verificar que migration e seed terminaram com sucesso**

```bash
docker compose ps -a --format "table {{.Service}}\t{{.Status}}"
```

Esperado: `migration` e `seed` com `Exited (0)`; `postgres`, `redis`, `backend` e `frontend` em `Up`.

- [ ] **Step 5: Verificar que só a porta 80 está publicada**

```bash
docker compose ps --format "table {{.Service}}\t{{.Ports}}"
```

Esperado: apenas o service `frontend` mostra mapeamento para o host, em `0.0.0.0:80->80/tcp`.

- [ ] **Step 6: Verificar a aplicação de ponta a ponta**

```bash
curl -s -o /dev/null -w "raiz:%{http_code}\n" http://localhost/
curl -s -o /dev/null -w "rota-spa:%{http_code}\n" http://localhost/accounts
curl -s -X POST http://localhost/api/v1/accounts/authentication \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

Esperado: `raiz:200`, `rota-spa:200` e um JSON com token JWT.

- [ ] **Step 7: Verificar a idempotência de uma segunda subida**

```bash
docker compose down
docker compose up -d
docker compose ps -a --format "table {{.Service}}\t{{.Status}}"
```

Esperado: `migration` e `seed` novamente com `Exited (0)` — sem erro de migration já aplicada nem de conta duplicada — e a stack no ar.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): compose de producao com stack completa em uma subida"
```

---

### Task 9: Documentação e verificação final

Documenta os dois fluxos no readme e confirma que ambos funcionam a partir de um estado limpo.

**Files:**
- Modify: `readme.md`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 8.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Ler o readme atual**

```bash
cat readme.md
```

Preservar o conteúdo existente e acrescentar as seções abaixo, adaptando o tom ao que já está escrito.

- [ ] **Step 2: Acrescentar a seção de execução ao `readme.md`**

````markdown
## Executando

### Produção

Requisito: Docker com Compose v2.

```bash
docker compose up --build -d
```

A stack sobe na ordem: Postgres e Redis, migrations, seed, backend e nginx.
A aplicação fica disponível em `http://localhost`. Nenhuma outra porta é
publicada no host — Postgres, Redis e backend só são alcançáveis dentro da
network `ticketin`.

Contas criadas pelo seed, todas com a senha `123456`:

| Usuário   | Papel  |
|-----------|--------|
| `admin`   | ADMIN  |
| `support` | MASTER |
| `user`    | USER   |

Para derrubar: `docker compose down`. Para derrubar apagando os volumes:
`docker compose down -v`.

### Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` sobe apenas Postgres e Redis em container, aguarda os
healthchecks, aplica as migrations e inicia backend e frontend na máquina com
hot reload. O Swagger fica em `http://localhost:3000/docs` — ele não é exposto
na stack de produção.

Scripts auxiliares:

| Script                     | O que faz |
|----------------------------|-----------|
| `npm run services:up`      | Sobe Postgres e Redis de desenvolvimento |
| `npm run services:down`    | Derruba os serviços de desenvolvimento |
| `npm run build`            | Gera o Prisma Client e compila backend e frontend |
| `npm run migration:deploy` | Aplica as migrations pendentes |
| `npm run migration:create` | Cria uma nova migration a partir do schema |
| `npm run migration:seed`   | Popula o banco com as contas padrão |
| `npm run prod:logs`        | Acompanha os logs da stack de produção |
````

- [ ] **Step 3: Verificar o fluxo de produção a partir do zero**

```bash
docker compose down -v
npm run prod:up
docker compose ps -a --format "table {{.Service}}\t{{.Status}}"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/
```

Esperado: `migration` e `seed` com `Exited (0)`, os demais `Up`, e `200`.

- [ ] **Step 4: Verificar o fluxo de desenvolvimento**

```bash
npm run prod:down
npm run services:up
npm run migration:deploy
```

Esperado: os dois containers `_dev` saudáveis e as migrations aplicadas sem erro.

- [ ] **Step 5: Confirmar que o repositório está limpo**

```bash
git status --short
```

Esperado: nenhuma saída. Se `frontend/dist`, `backend/dist` ou `prisma/generated` aparecerem, o `.gitignore` precisa ser conferido antes do commit.

- [ ] **Step 6: Commit**

```bash
git add readme.md
git commit -m "docs: documentar execucao em producao e desenvolvimento"
```
