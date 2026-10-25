FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=4721
ENV DEMO_MODE=true
ENV LLM_ENABLED=false
EXPOSE 4721
CMD ["npm", "start"]
