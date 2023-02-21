package slslambda

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
)

func Test_wrapUserHandlerPanics(t *testing.T) {
	require.NoError(t, os.Setenv("SLS_ORG_ID", "1234abcd"))
	type args struct {
		handler any
		options []Option
	}
	tests := []struct {
		name      string
		args      args
		assertion func(t assert.TestingT, f assert.PanicTestFunc, msgAndArgs ...interface{}) bool
	}{
		{
			name: "user handler panics",
			args: args{
				handler: func() {
					panic("something went wrong")
				},
			},
			assertion: assert.Panics,
		},
		{
			name: "user handler does not panic",
			args: args{
				handler: func() (string, error) {
					fmt.Println("executing handler")
					return "return value", nil
				},
			},
			assertion: assert.NotPanics,
		},
		{
			name: "user handler is nil",
			args: args{
				handler: nil,
			},
			assertion: assert.NotPanics,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := wrap(tt.args.handler, tt.args.options)
			tt.assertion(t, func() {
				handlerFunc := handler.(bytesHandlerFunc)
				output, err := handlerFunc(context.Background(), []byte{})
				t.Logf("%s", output)
				t.Log(err)
			})
		})
	}
}
