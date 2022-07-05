package reporter

import (
	"aws-lambda-otel-extension/external/types"
	"reflect"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
)

const NANO_MILLI = 1000 * 1000
const logsData = `[{"time":"2022-06-23T18:14:44.959Z","type":"platform.start","record":{"requestId":"b5051b53-a6df-4bb7-aba7-874520d1ec77","version":"$LATEST"}},{"time":"2022-06-23T18:14:44.993Z","type":"function","record":"2022-06-23T18:14:44.993Z\tb5051b53-a6df-4bb7-aba7-874520d1ec77\tINFO\tInside Lambda function handler\n"},{"time":"2022-06-23T18:14:45.495Z","type":"function","record":"2022-06-23T18:14:45.494Z\tb5051b53-a6df-4bb7-aba7-874520d1ec77\tINFO\tAfter sleep\n"},{"time":"2022-06-23T18:14:45.498Z","type":"platform.runtimeDone","record":{"requestId":"b5051b53-a6df-4bb7-aba7-874520d1ec77","status":"success"}},{"time":"2022-06-23T18:14:45.499Z","type":"platform.end","record":{"requestId":"b5051b53-a6df-4bb7-aba7-874520d1ec77"}},{"time":"2022-06-23T18:14:45.499Z","type":"platform.report","record":{"requestId":"b5051b53-a6df-4bb7-aba7-874520d1ec77","metrics":{"durationMs":537.68,"billedDurationMs":538,"memorySizeMB":1024,"maxMemoryUsedMB":92}}}]`

func Test_parseLogsAPIPayload(t *testing.T) {
	type args struct {
		data []byte
	}
	tests := []struct {
		name    string
		args    args
		want    []LogMessage
		wantErr bool
	}{
		{
			name: "parseLogsAPIPayload",
			args: args{
				data: []byte(logsData),
			},
			want: []LogMessage{
				{
					Time:    time.Date(2022, 6, 23, 18, 14, 44, 959*NANO_MILLI, time.UTC),
					LogType: "platform.start",
					ObjectRecord: types.PlatformObjectRecord{
						RequestID: "b5051b53-a6df-4bb7-aba7-874520d1ec77",
						StartLogItem: types.StartLogItem{
							Version: "$LATEST",
						},
					},
					StringRecord: "START RequestId: b5051b53-a6df-4bb7-aba7-874520d1ec77 Version: $LATEST",
				},
				{
					Time:         time.Date(2022, 6, 23, 18, 14, 44, 993*NANO_MILLI, time.UTC),
					LogType:      "function",
					StringRecord: "2022-06-23T18:14:44.993Z\tb5051b53-a6df-4bb7-aba7-874520d1ec77\tINFO\tInside Lambda function handler\n",
				},
				{
					Time:         time.Date(2022, 6, 23, 18, 14, 45, 495*NANO_MILLI, time.UTC),
					LogType:      "function",
					StringRecord: "2022-06-23T18:14:45.494Z\tb5051b53-a6df-4bb7-aba7-874520d1ec77\tINFO\tAfter sleep\n",
				},
				{
					Time:    time.Date(2022, 6, 23, 18, 14, 45, 498*NANO_MILLI, time.UTC),
					LogType: "platform.runtimeDone",
					ObjectRecord: types.PlatformObjectRecord{
						RequestID:       "b5051b53-a6df-4bb7-aba7-874520d1ec77",
						RuntimeDoneItem: "success",
					},
				},
				{
					Time:         time.Date(2022, 6, 23, 18, 14, 45, 499*NANO_MILLI, time.UTC),
					LogType:      "platform.end",
					StringRecord: "END RequestId: b5051b53-a6df-4bb7-aba7-874520d1ec77",
					ObjectRecord: types.PlatformObjectRecord{
						RequestID: "b5051b53-a6df-4bb7-aba7-874520d1ec77",
					},
				},
				{
					Time:         time.Date(2022, 6, 23, 18, 14, 45, 499*NANO_MILLI, time.UTC),
					LogType:      "platform.report",
					StringRecord: "",
					ObjectRecord: types.PlatformObjectRecord{
						RequestID: "b5051b53-a6df-4bb7-aba7-874520d1ec77",
						ReportLogItem: types.ReportLogMetrics{
							DurationMs:       537.68,
							BilledDurationMs: 538,
							MemorySizeMB:     1024,
							MaxMemoryUsedMB:  92,
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseLogsAPIPayload(tt.args.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseLogsAPIPayload() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			for i, gotMsg := range got {
				if !reflect.DeepEqual(gotMsg, tt.want[i]) {
					t.Errorf("parseLogsAPIPayload() = \ngot %v\nwant %v\n\n", spew.Sdump(gotMsg), spew.Sdump(tt.want[i]))
				}
			}
		})
	}
}

func Test_readLogs(t *testing.T) {
	type args struct {
		data []LogMessage
	}

	logMsgs, _ := ParseLogsAPIPayload([]byte(logsData))

	tests := []struct {
		name    string
		args    args
		want    []types.LogJson
		wantErr bool
	}{{
		name: "readLogs",
		args: args{
			data: logMsgs,
		},
		want: []types.LogJson{
			{
				Body: &logMsgs[0].StringRecord,
			},
			{
				Body: &logMsgs[1].StringRecord,
			},
			{
				Body: &logMsgs[2].StringRecord,
			},
			{
				Body: &logMsgs[3].StringRecord,
			},
			{
				Body: &logMsgs[4].StringRecord,
			},
			{
				Body: &logMsgs[5].StringRecord,
			},
		},
	},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ReadLogs(tt.args.data, &types.EventDataPayload{})
			if (err != nil) != tt.wantErr {
				t.Errorf("readLogs() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			for i, gotMsg := range got {
				if !reflect.DeepEqual(gotMsg, tt.want[i]) {
					t.Errorf("readLogs() = \ngot %v\nwant %v\n\n", spew.Sdump(gotMsg), spew.Sdump(tt.want[i]))
				}
			}
		})
	}
}
