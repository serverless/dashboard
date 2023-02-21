package slslambda

import "fmt"

func debugLog(s ...any) {
	fmt.Println(append([]any{"⚡ SDK:"}, s...)...)
}
