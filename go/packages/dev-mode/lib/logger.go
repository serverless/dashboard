package lib

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"os"
	"time"

	"go.uber.org/zap"
)

type Logger = zap.Logger

func PrettyPrint(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "\t")
	if err != nil {
		return ""
	}
	return string(data)
}

func NewLogger() (logger *zap.Logger) {
	var err error
	stage, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	if !ok || stage == "" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}

	if err != nil {
		log.Fatalf("failed to initialize logger: %v", err)
	}
	return logger
}

var BaseLogger = log.New(os.Stdout, "", 0)

func Info(inputs ...interface{}) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	if ok {
		messages := append([]interface{}{"⚡ DEV-MODE INFO: "}, inputs...)
		BaseLogger.Println(messages...)
	}
}

func Error(inputs ...interface{}) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	if ok {
		messages := append([]interface{}{"⚡ DEV-MODE ERROR: "}, inputs...)
		BaseLogger.Println(messages...)
	}
}

func ReportInitialization() {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: initialization")
	}
}

func ReportInitDuration(t time.Time) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: Overhead duration: External initialization:%d\n", time.Since(t).Milliseconds())
	}
}

func ReportOverheadDuration(t time.Time) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: Overhead duration: External request:%d\n", time.Since(t).Milliseconds())
	}
}

func ReportLog(logPayload string) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: Log###%s", base64.StdEncoding.EncodeToString([]byte(logPayload)))
	}
}

func ReportReqRes(logPayload string) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: ReqRes###%s", base64.StdEncoding.EncodeToString([]byte(logPayload)))
	}
}

func ReportSpans(logPayload string) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("⚡ DEV-MODE: Traces###%s", base64.StdEncoding.EncodeToString([]byte(logPayload)))
	}
}

func ReportShutdownDuration(t time.Time) {
	_, ok := os.LookupEnv("SLS_DEBUG_EXTENSION")
	_, toLogs := os.LookupEnv("SLS_TEST_EXTENSION_LOG")
	if ok || toLogs {
		BaseLogger.Printf("Extension overhead duration: external shutdown:%d\n", time.Since(t).Milliseconds())
	}
}
