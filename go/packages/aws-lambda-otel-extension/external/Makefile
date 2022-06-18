build:
	rm -Rf dist/*
	GOOS=linux GOARCH=amd64 go build -o dist/extensions/otel-extension main.go
	cd dist; zip extension.zip -r extensions/

deploy:
	SERVERLESS_PLATFORM_STAGE=dev AWS_PROFILE=ServerlessPlatformTest1 sls deploy

proto:
	protoc --proto_path=proto --go_out=protoc proto/*

run:
	AWS_LAMBDA_RUNTIME_API="webhook.site/1bf33ef8-1840-4877-98f9-82e2ac8e60d4" go run main.go