package reporter

import (
	"aws-lambda-otel-extension/external/protoc"
	"reflect"
	"testing"

	"github.com/davecgh/go-spew/spew"
)

var attr1 = protoc.KeyValue{
	Key:   "key1",
	Value: &protoc.AnyValue{Value: &protoc.AnyValue_StringValue{StringValue: "value1"}},
}

var span1 = protoc.Span{
	TraceId: []byte("1111"),
	SpanId:  []byte("222"),
	Name:    "span1",
	Kind:    protoc.Span_SPAN_KIND_SERVER,
	Attributes: []*protoc.KeyValue{
		&attr1,
	},
}

func Test_batchOverflowSpans(t *testing.T) {

	// create a batch with 101 spans

	spans99 := []*protoc.Span{}
	spans101 := []*protoc.Span{}
	for i := 0; i < 99; i++ {
		spans99 = append(spans99, &span1)
		spans101 = append(spans101, &span1)
	}
	spans101 = append(spans101, &span1)
	spans101 = append(spans101, &span1)

	trace99 := &protoc.TracesData{
		ResourceSpans: []*protoc.ResourceSpans{
			{
				Resource: &protoc.Resource{
					Attributes: []*protoc.KeyValue{
						&attr1,
					},
				},
				InstrumentationLibrarySpans: []*protoc.InstrumentationLibrarySpans{
					{
						Spans: spans99,
					},
				},
			},
		},
	}

	trace101 := &protoc.TracesData{
		ResourceSpans: []*protoc.ResourceSpans{
			{
				Resource: &protoc.Resource{
					Attributes: []*protoc.KeyValue{
						&attr1,
					},
				},
				InstrumentationLibrarySpans: []*protoc.InstrumentationLibrarySpans{
					{
						Spans: spans101,
					},
				},
			},
		},
	}

	type args struct {
		traces *protoc.TracesData
	}
	tests := []struct {
		name string
		args args
		want *protoc.TracesData
	}{
		{
			name: "batchOverflowSpans 101 spans",
			args: args{
				traces: trace101,
			},
			want: &protoc.TracesData{
				ResourceSpans: []*protoc.ResourceSpans{
					{
						Resource: trace101.ResourceSpans[0].Resource,
						InstrumentationLibrarySpans: []*protoc.InstrumentationLibrarySpans{
							{
								Spans: spans101[:MaxSpansPerBatch],
							},
							{
								Spans: spans101[MaxSpansPerBatch:],
							},
						},
					},
				},
			},
		},
		{
			name: "batchOverflowSpans 99 spans",
			args: args{
				traces: trace99,
			},
			want: &protoc.TracesData{
				ResourceSpans: []*protoc.ResourceSpans{
					{
						Resource: trace99.ResourceSpans[0].Resource,
						InstrumentationLibrarySpans: []*protoc.InstrumentationLibrarySpans{
							{
								Spans: spans99,
							},
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := batchOverflowSpans(tt.args.traces)

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("batchOverflowSpans() = \ngot %v\nwant %v\n\n", spew.Sdump(got), spew.Sdump(tt.want))
			}
		})
	}
}
