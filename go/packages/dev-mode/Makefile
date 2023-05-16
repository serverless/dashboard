clean:
	rm -Rf dist/extension*

build_x86: clean
	GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o dist/extensions/dev-mode-extension main.go
	cd dist; zip extension.zip -r extensions/

build_arm64: clean
	GOOS=linux GOARCH=arm64 go build -ldflags "-s -w" -o dist/extensions/dev-mode-extension main.go
	cd dist; zip extension.zip -r extensions/

test:
	go test ./... -p 1 -v -count=1 -timeout 30s

deploy_x86: build_x86
	aws lambda publish-layer-version --layer-name sls-dev-mode --description "This layer will collect logs and forward them to serverless console. This should only be used in development" --zip-file fileb://dist/extension.zip

deploy_arm64: build_arm64
	aws lambda publish-layer-version --layer-name sls-dev-mode-arm --description "This layer will collect logs and forward them to serverless console. This should only be used in development" --zip-file fileb://dist/extension.zip
