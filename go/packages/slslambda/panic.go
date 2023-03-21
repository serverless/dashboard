package slslambda

// copied from github.com/aws/aws-lambda-go@v1.37.0/lambda/panic.go to use private functions
// in order to create and return original panic response of user handler to aws-lambda-go lib, see:
// https://github.com/aws/aws-lambda-go/blob/3dedc3285b5533729a20927fbf0fea1f1a167747/lambda/invoke_loop.go#L116

import (
	"fmt"
	"github.com/aws/aws-lambda-go/lambda/messages"
	"reflect"
	"runtime"
	"strings"
)

func lambdaPanicResponse(err interface{}) messages.InvokeResponse_Error {
	if ive, ok := err.(messages.InvokeResponse_Error); ok {
		return ive
	}
	panicInfo := getPanicInfo(err)
	return messages.InvokeResponse_Error{
		Message:    panicInfo.Message,
		Type:       getErrorType(err),
		StackTrace: panicInfo.StackTrace,
		ShouldExit: true,
	}
}

func getErrorType(err interface{}) string {
	errorType := reflect.TypeOf(err)
	if errorType.Kind() == reflect.Ptr {
		return errorType.Elem().Name()
	}
	return errorType.Name()
}

type panicInfo struct {
	Message    string                                      // Value passed to panic call, converted to string
	StackTrace []*messages.InvokeResponse_Error_StackFrame // Stack trace of the panic
}

func getPanicInfo(value interface{}) panicInfo {
	message := getPanicMessage(value)
	stack := getPanicStack()

	return panicInfo{Message: message, StackTrace: stack}
}

func getPanicMessage(value interface{}) string {
	return fmt.Sprintf("%v", value)
}

var defaultErrorFrameCount = 32

func getPanicStack() []*messages.InvokeResponse_Error_StackFrame {
	s := make([]uintptr, defaultErrorFrameCount)
	const framesToHide = 3 // this (getPanicStack) -> getPanicInfo -> handler defer func
	n := runtime.Callers(framesToHide, s)
	if n == 0 {
		return make([]*messages.InvokeResponse_Error_StackFrame, 0)
	}

	s = s[:n]

	return convertStack(s)
}

func convertStack(s []uintptr) []*messages.InvokeResponse_Error_StackFrame {
	var converted []*messages.InvokeResponse_Error_StackFrame
	frames := runtime.CallersFrames(s)

	for {
		frame, more := frames.Next()

		formattedFrame := formatFrame(frame)
		converted = append(converted, formattedFrame)

		if !more {
			break
		}
	}
	return converted
}

func formatFrame(inputFrame runtime.Frame) *messages.InvokeResponse_Error_StackFrame {
	path := inputFrame.File
	line := int32(inputFrame.Line)
	label := inputFrame.Function

	// Strip GOPATH from path by counting the number of seperators in label & path
	//
	// For example given this:
	//     GOPATH = /home/user
	//     path   = /home/user/src/pkg/sub/file.go
	//     label  = pkg/sub.Type.Method
	//
	// We want to set:
	//     path  = pkg/sub/file.go
	//     label = Type.Method

	i := len(path)
	for n, g := 0, strings.Count(label, "/")+2; n < g; n++ {
		i = strings.LastIndex(path[:i], "/")
		if i == -1 {
			// Something went wrong and path has less seperators than we expected
			// Abort and leave i as -1 to counteract the +1 below
			break
		}
	}

	path = path[i+1:] // Trim the initial /

	// Strip the path from the function name as it's already in the path
	label = label[strings.LastIndex(label, "/")+1:]
	// Likewise strip the package name
	label = label[strings.Index(label, ".")+1:]

	return &messages.InvokeResponse_Error_StackFrame{
		Path:  path,
		Line:  line,
		Label: label,
	}
}
