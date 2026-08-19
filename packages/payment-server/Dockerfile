FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY src ./src
COPY tsconfig.json ./

RUN npm install

EXPOSE 3220

CMD ["node", "src/index.ts"]
