package htmlparse

import (
	"reflect"
	"testing"
)

func TestExtractParagraphsBasic(t *testing.T) {
	html := `
	<html><body>
		<h1 data-tags="intro,overview">Title</h1>
		<p data-tags="foo,bar">First paragraph text.</p>
		<p>Second paragraph, no tags.</p>
		<ul>
			<li data-tags="list-item">Item one</li>
			<li>Item two</li>
		</ul>
	</body></html>`

	paragraphs, err := ExtractParagraphs(html)
	if err != nil {
		t.Fatalf("ExtractParagraphs error: %v", err)
	}

	want := []Paragraph{
		{Index: 0, Tag: "h1", Text: "Title", ParagraphTags: []string{"intro", "overview"}},
		{Index: 1, Tag: "p", Text: "First paragraph text.", ParagraphTags: []string{"foo", "bar"}},
		{Index: 2, Tag: "p", Text: "Second paragraph, no tags."},
		{Index: 3, Tag: "li", Text: "Item one", ParagraphTags: []string{"list-item"}},
		{Index: 4, Tag: "li", Text: "Item two"},
	}

	if len(paragraphs) != len(want) {
		t.Fatalf("got %d paragraphs, want %d: %+v", len(paragraphs), len(want), paragraphs)
	}
	for i := range want {
		got := paragraphs[i]
		if got.Tag != want[i].Tag || got.Text != want[i].Text || got.Index != want[i].Index {
			t.Errorf("paragraph %d: got %+v, want %+v", i, got, want[i])
		}
		if !reflect.DeepEqual(got.ParagraphTags, want[i].ParagraphTags) && !(len(got.ParagraphTags) == 0 && len(want[i].ParagraphTags) == 0) {
			t.Errorf("paragraph %d tags: got %v, want %v", i, got.ParagraphTags, want[i].ParagraphTags)
		}
	}
}

func TestExtractParagraphsEmptySkipped(t *testing.T) {
	html := `<p data-tags="foo">  </p><p>Real text</p>`
	paragraphs, err := ExtractParagraphs(html)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(paragraphs) != 1 {
		t.Fatalf("expected 1 non-empty paragraph, got %d: %+v", len(paragraphs), paragraphs)
	}
	if paragraphs[0].Text != "Real text" {
		t.Errorf("unexpected text: %q", paragraphs[0].Text)
	}
}

func TestExtractParagraphsNestedInline(t *testing.T) {
	html := `<p data-tags="x">Hello <strong>bold</strong> and <em>italic</em> text.</p>`
	paragraphs, err := ExtractParagraphs(html)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(paragraphs) != 1 {
		t.Fatalf("expected 1 paragraph, got %d", len(paragraphs))
	}
	want := "Hello bold and italic text."
	if paragraphs[0].Text != want {
		t.Errorf("got text %q, want %q", paragraphs[0].Text, want)
	}
}

func TestExtractParagraphsNestedBlock(t *testing.T) {
	// A <p> nested inside an <li> should produce two separate paragraphs,
	// each with only their own text.
	html := `<li data-tags="outer">Intro <p data-tags="inner">Nested paragraph</p></li>`
	paragraphs, err := ExtractParagraphs(html)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(paragraphs) != 2 {
		t.Fatalf("expected 2 paragraphs, got %d: %+v", len(paragraphs), paragraphs)
	}
	if paragraphs[0].Tag != "li" || paragraphs[0].Text != "Intro" {
		t.Errorf("outer paragraph unexpected: %+v", paragraphs[0])
	}
	if paragraphs[1].Tag != "p" || paragraphs[1].Text != "Nested paragraph" {
		t.Errorf("inner paragraph unexpected: %+v", paragraphs[1])
	}
}
