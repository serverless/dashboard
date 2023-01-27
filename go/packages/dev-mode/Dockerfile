FROM golang:1.18-alpine AS installer

# Move to opt folder
WORKDIR /opt

# Copy code
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
# Build for arm64
RUN GOOS=linux GOARCH=arm64 go build -ldflags "-s -w" -o extensions/dev-mode-extension main.go
# Add permissions
RUN chmod -R 755 extensions/dev-mode-extension

FROM scratch AS base
WORKDIR /opt/extensions
COPY --from=installer /opt/extensions .
