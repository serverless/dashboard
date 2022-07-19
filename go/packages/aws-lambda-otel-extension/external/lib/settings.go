package lib

import (
	"encoding/json"
	"net/url"
	"os"
)

type UserSettings struct {
	Common struct {
		Destination struct {
			RequestHeaders string `json:"requestHeaders"`
		} `json:"destination"`
	} `json:"common"`
}

type ExtensionSettingsEndpoint struct {
	ForceJson   bool   `json:"-"`
	Disabled    bool   `json:"disabled"`
	Destination string `json:"-"`
}

type ExtensionSettings struct {
	Metrics     ExtensionSettingsEndpoint `json:"metrics"`
	Logs        ExtensionSettingsEndpoint `json:"logs"`
	Traces      ExtensionSettingsEndpoint `json:"traces"`
	Request     ExtensionSettingsEndpoint `json:"request"`
	Response    ExtensionSettingsEndpoint `json:"response"`
	OrgID       string                    `json:"orgId"`
	Namespace   string                    `json:"namespace"`
	Environment string                    `json:"environment"`
	IngestToken string                    `json:"ingestToken"`
	// Custom settings
	SandboxHostname string `json:"-"`
}

func GetExtensionSettings() (ExtensionSettings, error) {
	var extensionSettings ExtensionSettings
	extensionSettingsText := os.Getenv("SLS_EXTENSION")
	if extensionSettingsText != "" {
		err := json.Unmarshal([]byte(extensionSettingsText), &extensionSettings)
		if err != nil {
			return ExtensionSettings{}, err
		}
	}

	// Custom settings
	testJson := os.Getenv("SLS_TEST_EXTENSION_REPORT_TYPE") == "json"
	testDestination := os.Getenv("SLS_TEST_EXTENSION_REPORT_DESTINATION")
	platformStage := os.Getenv("SLS_PLATFORM_STAGE")

	if testJson || testDestination == "log" {
		extensionSettings.Metrics.ForceJson = true
		extensionSettings.Logs.ForceJson = true
		extensionSettings.Traces.ForceJson = true
		extensionSettings.Request.ForceJson = true
		extensionSettings.Response.ForceJson = true
	}

	backendUrl := "https://core.serverless.com"
	if extensionSettings.Environment == "dev" || platformStage == "dev" {
		backendUrl = "https://core.serverless-dev.com"
	}
	ingestionServerUrl := backendUrl + "/ingestion/kinesis"

	sandboxHostname := os.Getenv("SLS_TEST_EXTENSION_HOSTNAME")
	if sandboxHostname != "" {
		extensionSettings.SandboxHostname = sandboxHostname
	} else {
		extensionSettings.SandboxHostname = "sandbox"
	}

	if testDestination == "log" {
		return extensionSettings, nil
	} else if testDestination != "" {
		ingestionServerUrl = testDestination
	}

	extensionSettings.Metrics.Destination = ingestionServerUrl + "/v1/metrics"
	extensionSettings.Logs.Destination = ingestionServerUrl + "/v1/logs"
	extensionSettings.Traces.Destination = ingestionServerUrl + "/v1/traces"
	extensionSettings.Request.Destination = ingestionServerUrl + "/v1/request-response"
	extensionSettings.Response.Destination = ingestionServerUrl + "/v1/request-response"

	// TODO: remove above lines when we finish the var migration
	customSettingsText := os.Getenv("SLS_OTEL_USER_SETTINGS")
	if customSettingsText != "" {
		var customSettings UserSettings
		err := json.Unmarshal([]byte(customSettingsText), &customSettings)
		if err != nil {
			return ExtensionSettings{}, err
		}
		extraParams, err := url.ParseQuery(customSettings.Common.Destination.RequestHeaders)
		if err != nil {
			return ExtensionSettings{}, err
		}
		extensionSettings.IngestToken = extraParams.Get("serverless_token")
	}

	return extensionSettings, nil
}
