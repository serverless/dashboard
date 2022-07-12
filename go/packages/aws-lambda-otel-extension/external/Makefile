build:
	rm -Rf dist/extension*
	GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o dist/extensions/otel-extension main.go
	cd dist; zip extension.zip -r extensions/ otel-extension-internal-node/

deploy:
	SERVERLESS_PLATFORM_STAGE=dev AWS_PROFILE=ServerlessPlatformTest1 sls deploy

proto:
	protoc --proto_path=proto --go_out=protoc proto/*

test:
	go test ./...
