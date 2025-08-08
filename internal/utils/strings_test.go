package utils

import (
	"testing"
)

func TestTrimAndUpper(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"  hello  ", "HELLO"},
		{"SELECT * FROM", "SELECT * FROM"},
		{"\t\nquery\r\n", "QUERY"},
		{"", ""},
	}

	for _, tt := range tests {
		result := TrimAndUpper(tt.input)
		if result != tt.expected {
			t.Errorf("TrimAndUpper(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestExtractFirstWord(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"volumes v JOIN", "volumes"},
		{"`quoted` table", "quoted"},
		{"'single' quotes", "single"},
		{"", ""},
		{"   ", ""},
	}

	for _, tt := range tests {
		result := ExtractFirstWord(tt.input)
		if result != tt.expected {
			t.Errorf("ExtractFirstWord(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSplitAndGetAfter(t *testing.T) {
	tests := []struct {
		input     string
		delimiter string
		expected  string
	}{
		{"SELECT * FROM volumes", "FROM", "volumes"},
		{"INSERT INTO table", "INTO", "table"},
		{"no delimiter here", "MISSING", ""},
		{"", "ANY", ""},
	}

	for _, tt := range tests {
		result := SplitAndGetAfter(tt.input, tt.delimiter)
		if result != tt.expected {
			t.Errorf("SplitAndGetAfter(%q, %q) = %q, want %q",
				tt.input, tt.delimiter, result, tt.expected)
		}
	}
}

func TestHasAnyPrefix(t *testing.T) {
	tests := []struct {
		input    string
		prefixes []string
		expected bool
	}{
		{"SELECT * FROM", []string{"SELECT", "INSERT"}, true},
		{"UPDATE table", []string{"SELECT", "INSERT"}, false},
		{"select lower", []string{"SELECT"}, true}, // case insensitive
		{"", []string{"ANY"}, false},
	}

	for _, tt := range tests {
		result := HasAnyPrefix(tt.input, tt.prefixes...)
		if result != tt.expected {
			t.Errorf("HasAnyPrefix(%q, %v) = %v, want %v",
				tt.input, tt.prefixes, result, tt.expected)
		}
	}
}

func TestContainsAny(t *testing.T) {
	tests := []struct {
		input    string
		substrs  []string
		expected bool
	}{
		{"WITH cte AS SELECT", []string{"SELECT", "INSERT"}, true},
		{"UPDATE table SET", []string{"SELECT", "INSERT"}, false},
		{"has select in middle", []string{"SELECT"}, true}, // case insensitive
		{"", []string{"ANY"}, false},
	}

	for _, tt := range tests {
		result := ContainsAny(tt.input, tt.substrs...)
		if result != tt.expected {
			t.Errorf("ContainsAny(%q, %v) = %v, want %v",
				tt.input, tt.substrs, result, tt.expected)
		}
	}
}

func TestSafeLower(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"VOLUMES", "volumes"},
		{"`Quoted`", "quoted"},
		{"'Single'", "single"},
		{"\"Double\"", "double"},
		{"", ""},
	}

	for _, tt := range tests {
		result := SafeLower(tt.input)
		if result != tt.expected {
			t.Errorf("SafeLower(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestCamelToSnake(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"CamelCase", "camel_case"},
		{"HTTPResponse", "h_t_t_p_response"},
		{"ID", "i_d"},
		{"lowercase", "lowercase"},
		{"", ""},
	}

	for _, tt := range tests {
		result := CamelToSnake(tt.input)
		if result != tt.expected {
			t.Errorf("CamelToSnake(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSnakeToCamel(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"snake_case", "SnakeCase"},
		{"http_response", "HttpResponse"},
		{"id", "Id"},
		{"already_camel", "AlreadyCamel"},
		{"", ""},
	}

	for _, tt := range tests {
		result := SnakeToCamel(tt.input)
		if result != tt.expected {
			t.Errorf("SnakeToCamel(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestContainsIgnoreCase(t *testing.T) {
	tests := []struct {
		input    string
		substr   string
		expected bool
	}{
		{"Hello World", "world", true},
		{"Hello World", "WORLD", true},
		{"Hello World", "hello", true},
		{"Hello World", "xyz", false},
		{"", "anything", false},
		{"something", "", true}, // empty substring always matches
	}

	for _, tt := range tests {
		result := ContainsIgnoreCase(tt.input, tt.substr)
		if result != tt.expected {
			t.Errorf("ContainsIgnoreCase(%q, %q) = %v, want %v",
				tt.input, tt.substr, result, tt.expected)
		}
	}
}
