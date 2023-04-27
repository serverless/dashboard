package slslambda

import (
	"fmt"
	"os"
)

func debugLog(s ...any) {
	if _, ok := os.LookupEnv("SLS_DEBUG"); ok {
		fmt.Println(append([]any{"⚡ SDK:"}, s...)...)
	}
}
