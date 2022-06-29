package lib

import (
	"encoding/json"
	"os"
)

var userSettingsText = os.Getenv("SLS_OTEL_USER_SETTINGS")

type UserSettingsEndpoint struct {
	OutputType  string `json:"outputType"`
	Destination string `json:"destination"`
	Disabled    bool   `json:"disabled"`
}

type UserSettings struct {
	Metrics  UserSettingsEndpoint `json:"metrics"`
	Logs     UserSettingsEndpoint `json:"logs"`
	Traces   UserSettingsEndpoint `json:"traces"`
	Request  UserSettingsEndpoint `json:"request"`
	Response UserSettingsEndpoint `json:"response"`
	Common   struct {
		Destination struct {
			RequestHeaders string `json:"requestHeaders"`
		} `json:"destination"`
	} `json:"common"`
}

func GetUserSettings() (UserSettings, error) {
	var userSettings UserSettings
	err := json.Unmarshal([]byte(userSettingsText), &userSettings)
	// TODO: remove this, used for development only
	// customSettingsText := os.Getenv("SLS_OTEL_DEBUG_USER_SETTINGS")
	// if customSettingsText != "" {
	// 	err = json.Unmarshal([]byte(customSettingsText), &userSettings)
	// }
	if err != nil {
		return UserSettings{}, err
	}
	return userSettings, nil
}
