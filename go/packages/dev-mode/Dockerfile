FROM alpine:latest AS installer

RUN mkdir -p /opt/extensions
WORKDIR /opt/extensions
COPY dist/extensions .
RUN chmod -R 755 dev-mode-extension

FROM scratch AS base
WORKDIR /opt/extensions
COPY --from=installer /opt/extensions/dev-mode-extension .
