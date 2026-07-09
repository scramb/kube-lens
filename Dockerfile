# syntax=docker/dockerfile:1

FROM node:20-bookworm AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-bookworm AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
COPY --from=frontend /src/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 go build -tags server -o /out/kube-lens .

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=backend /out/kube-lens /usr/local/bin/kube-lens
EXPOSE 8399
ENTRYPOINT ["/usr/local/bin/kube-lens", "--server", "--addr", "0.0.0.0:8399"]
