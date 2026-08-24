#########################
####### BUILD ENV #######
#########################
FROM node:24.19.0-alpine AS build

RUN npm install -g @nestjs/cli@10

USER node

WORKDIR /home/dashboard-nestjs

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node . .

RUN npx prisma generate --schema=libs/database/prisma/schema.prisma

RUN npm run build:prod

##########################
####### BUILD PROD #######
##########################
FROM node:24.19.0-alpine AS prod

RUN apk add --no-cache curl
RUN npm install -g pm2 pm2-runtime

USER node

WORKDIR /home/dashboard-nestjs

COPY --from=build --chown=node:node /home/dashboard-nestjs ./

EXPOSE 3005 3006

# Start the application with PM2
CMD ["pm2-runtime", "start", "./start-prod.json"]