package reporter

import "testing"

func Test_getTimeUnixNano(t *testing.T) {
	type args struct {
		value interface{}
	}
	tests := []struct {
		name string
		args args
		want uint64
	}{
		{
			name: "string",
			args: args{
				value: "2020-01-01T15:04:05.999999999Z",
			},
			want: 1577891045999999999,
		},
		{
			name: "int64",
			args: args{
				value: int64(1577836800000),
			},
			want: 1577836800000000000,
		},
		{
			name: "int",
			args: args{
				value: 1577836800000,
			},
			want: 1577836800000000000,
		},
		{
			name: "float64",
			args: args{
				value: float64(1577836800000),
			},
			want: 1577836800000000000,
		},
		{
			name: "float32",
			args: args{
				value: float32(1577836800000),
			},
			// want: 1577836800000000000, but float32 is not fully supported
			want: 1577836740608000000,
		},
		{
			name: "bool",
			args: args{
				value: true,
			},
			want: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getTimeUnixNano(tt.args.value); got != tt.want {
				t.Errorf("getTimeUnixNano() = %v, want %v", got, tt.want)
			}
		})
	}
}
