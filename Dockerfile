# --- Estágio 1: Builder (usando Bun) ---
FROM oven/bun:1 AS builder

WORKDIR /app

# Copia os arquivos de definição de dependências
COPY package.json bun.lock ./

# Instala as dependências (incluindo as de desenvolvimento para o build)
RUN bun install --frozen-lockfile

# Copia o restante do código fonte
COPY . .

# Executa o script de build definido no package.json
# Isso criará a pasta ./bin com o código compilado para Node.js
RUN bun run build

# --- Estágio 2: Runtime (usando Puppeteer/Chrome) ---
# Usa a imagem oficial do Puppeteer que já inclui um navegador compatível
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Copia apenas os artefatos construídos do estágio anterior
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/package.json ./

# Copia o arquivo de configuração específico para Docker
COPY docker-config.json ./etc/docker.json

# Instala dependências de produção
USER root
RUN npm install --omit=dev
USER pptruser

# Expõe a porta padrão
EXPOSE 3000

# O ponto de entrada permanece o mesmo
ENTRYPOINT ["node", "/app/bin/index.js", "/app/etc/docker.json"]