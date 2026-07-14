package tagexpr

import "testing"

func TestParseAndEval(t *testing.T) {
	cases := []struct {
		name string
		expr string
		tags []string
		want bool
	}{
		{
			name: "simple atom match",
			expr: "foo",
			tags: []string{"foo/bar"},
			want: true,
		},
		{
			name: "simple atom no match",
			expr: "foo",
			tags: []string{"bar"},
			want: false,
		},
		{
			name: "and both present",
			expr: "foo AND bar",
			tags: []string{"foo", "bar"},
			want: true,
		},
		{
			name: "and missing one",
			expr: "foo AND bar",
			tags: []string{"foo"},
			want: false,
		},
		{
			name: "or either",
			expr: "foo OR bar",
			tags: []string{"bar"},
			want: true,
		},
		{
			name: "not excludes",
			expr: "NOT archived",
			tags: []string{"project"},
			want: true,
		},
		{
			name: "not excludes present",
			expr: "NOT archived",
			tags: []string{"archived"},
			want: false,
		},
		{
			name: "grouped precedence",
			expr: "foo AND (bar OR baz)",
			tags: []string{"foo", "baz"},
			want: true,
		},
		{
			name: "grouped precedence fails",
			expr: "foo AND (bar OR baz)",
			tags: []string{"foo"},
			want: false,
		},
		{
			name: "case insensitive substring",
			expr: "Proj",
			tags: []string{"project/alpha"},
			want: true,
		},
		{
			name: "not with and",
			expr: "foo AND NOT bar",
			tags: []string{"foo"},
			want: true,
		},
		{
			name: "not with and excluded",
			expr: "foo AND NOT bar",
			tags: []string{"foo", "bar"},
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := Parse(tc.expr)
			if err != nil {
				t.Fatalf("Parse(%q) error: %v", tc.expr, err)
			}
			if expr == nil {
				t.Fatalf("Parse(%q) returned nil expr", tc.expr)
			}
			got := expr.Eval(tc.tags)
			if got != tc.want {
				t.Errorf("Eval(%v) for expr %q = %v, want %v", tc.tags, tc.expr, got, tc.want)
			}
		})
	}
}

func TestParseEmpty(t *testing.T) {
	expr, err := Parse("   ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expr != nil {
		t.Fatalf("expected nil expr for empty input, got %v", expr)
	}
}

func TestParseErrors(t *testing.T) {
	badInputs := []string{
		"foo AND",
		"AND foo",
		"(foo",
		"foo)",
		"foo OR OR bar",
	}
	for _, in := range badInputs {
		if _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) expected error, got nil", in)
		}
	}
}

func TestExprString(t *testing.T) {
	expr, err := Parse("foo AND (bar OR baz)")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := expr.String()
	want := "foo AND (bar OR baz)"
	if got != want {
		t.Errorf("String() = %q, want %q", got, want)
	}
}
