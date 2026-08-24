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
