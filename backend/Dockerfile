FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY backend backend
COPY database database
COPY frontend frontend
COPY .env.example .env
ENV DATABASE_URL=postgresql://pgclt:pgclt_dev@database:5432/pgclt?schema=public
RUN npm run db:generate
RUN npm --workspace backend run build
RUN npm --workspace frontend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/database ./database
COPY --from=build /app/.env.example ./.env
COPY package.json ./package.json
EXPOSE 4000
VOLUME ["/app/backend/uploads"]
CMD ["node", "backend/dist/server.js"]
