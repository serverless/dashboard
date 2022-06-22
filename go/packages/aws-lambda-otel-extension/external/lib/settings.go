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
	Request  UserSettingsEndpoint `json:"request"`
	Response UserSettingsEndpoint `json:"response"`
}

func GetUserSettings() (UserSettings, error) {
	var userSettings UserSettings
	err := json.Unmarshal([]byte(userSettingsText), &userSettings)
	if err != nil {
		return UserSettings{}, err
	}
	return userSettings, nil
}
