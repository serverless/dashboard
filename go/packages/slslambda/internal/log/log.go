package log

import "fmt"

func Debug(s ...any) {
	fmt.Println("⚡ SDK:", s)
}
