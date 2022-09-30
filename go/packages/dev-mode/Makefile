clean:
	rm -Rf dist/extension*

build: clean
	GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o dist/extensions/dev-mode-extension main.go
	cd dist; zip extension.zip -r extensions/

test:
	go test ./... -v -count=1 -timeout 30s

deploy: build
	aws lambda publish-layer-version --layer-name sls-dev-mode --description "This layer will collect logs and forward them to serverless console. This should only be used in development" --zip-file fileb://dist/extension.zip
