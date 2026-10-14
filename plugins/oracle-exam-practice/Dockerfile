FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8787 EXAM_DB=/app/data/attempts.sqlite
EXPOSE 8787
CMD ["npm", "start"]
