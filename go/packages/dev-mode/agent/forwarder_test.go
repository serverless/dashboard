package agent

import "testing"

func TestProcessLoggerLevelWarning(t *testing.T) {
	fakeLevel1 := interface{}("WARNING")
	levelOutput1 := ProcessLoggerLevel(fakeLevel1)
	if levelOutput1 != "WARNING" {
		t.Errorf("Expected levelOutput to be 'WARNING', got %s", levelOutput1)
	}

	fakeLevel2 := interface{}("WARN")
	levelOutput2 := ProcessLoggerLevel(fakeLevel2)
	if levelOutput2 != "WARN" {
		t.Errorf("Expected levelOutput to be 'WARN', got %s", levelOutput2)
	}

	fakeLevel3 := interface{}(35)
	levelOutput3 := ProcessLoggerLevel(fakeLevel3)
	if levelOutput3 != "WARN" {
		t.Errorf("Expected levelOutput to be 'WARN', got %s", levelOutput3)
	}
}

func TestProcessLoggerLevelError(t *testing.T) {
	fakeLevel1 := interface{}("ERROR")
	levelOutput1 := ProcessLoggerLevel(fakeLevel1)
	if levelOutput1 != "ERROR" {
		t.Errorf("Expected levelOutput to be 'ERROR', got %s", levelOutput1)
	}

	fakeLevel2 := interface{}(41)
	levelOutput2 := ProcessLoggerLevel(fakeLevel2)
	if levelOutput2 != "ERROR" {
		t.Errorf("Expected levelOutput to be 'ERROR', got %s", levelOutput2)
	}
}
