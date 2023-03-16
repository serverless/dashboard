cd "$1" || exit
GOOS=linux GOARCH=$2 go build -o build/$2/bootstrap main.go
