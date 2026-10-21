FROM node:24-alpine AS build

WORKDIR /app

RUN npm install --global pnpm@12.14.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

FROM node:24-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

RUN npm install --global pnpm@12.14.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
