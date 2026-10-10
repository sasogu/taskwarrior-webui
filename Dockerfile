# Taskwarrior 2.6.2 is what Alpine 3.18 ships; newer Alpine releases ship
# Taskwarrior 3, whose storage is incompatible with the existing 2.x data.
ARG ALPINE=3.18

FROM alpine:${ALPINE} AS build
RUN apk --no-cache add nodejs npm python3 build-base
ENV NODE_OPTIONS="--openssl-legacy-provider"
COPY ./frontend /src/frontend
RUN cd /src/frontend && npm ci && npm run build && npm run export
COPY ./backend /src/backend
RUN cd /src/backend && npm ci && npm run build && npm prune --omit=dev

FROM alpine:${ALPINE}
# python3: the existing on-add hook is a Python script
RUN apk --no-cache add nodejs task python3 tzdata \
	&& [ "$(task --version)" = "2.6.2" ]
COPY --from=build /src/frontend/dist /static
COPY --from=build /src/backend/dist /app/dist
COPY --from=build /src/backend/node_modules /app/node_modules
ENV NODE_ENV=production PORT=8080 STATIC_DIR=/static \
	TASKRC=/config/taskrc TASKDATA=/data
USER 1000:1000
WORKDIR /app
EXPOSE 8080
CMD ["node", "dist/app.js"]
