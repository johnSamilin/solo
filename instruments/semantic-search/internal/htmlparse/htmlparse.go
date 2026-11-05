// Package htmlparse extracts indexable paragraph-level chunks from the HTML
// note files produced by the Solo editor. Each block-level element (p,
// h1-h6, li) with a "data-tags" attribute becomes a separate chunk carrying
// its own paragraph tags, matching the client-side ParagraphTags extension.
package htmlparse

import (
	"fmt"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// Paragraph represents a single indexable chunk extracted from a note's
// HTML content.
type Paragraph struct {
	// Index is the zero-based position of this paragraph among all
	// extracted paragraphs in the document (in document order).
	Index int
	// Tag is the originating HTML tag name (p, h1..h6, li).
	Tag string
	// Text is the plain-text content of the element (direct + inline
	// descendant text, excluding text belonging to nested block elements),
	// whitespace-normalized.
	Text string
	// ParagraphTags are the tags declared via the data-tags attribute on
	// this specific element.
	ParagraphTags []string
}

var blockAtoms = map[atom.Atom]bool{
	atom.P:  true,
	atom.H1: true,
	atom.H2: true,
	atom.H3: true,
	atom.H4: true,
	atom.H5: true,
	atom.H6: true,
	atom.Li: true,
}

// ExtractParagraphs parses an HTML document and returns all block-level
// paragraph/heading/list-item elements as Paragraph chunks, in document
// order. Elements with empty text content are skipped. If a block element
// contains nested block elements (e.g. a <p> inside an <li>), each
// contributes its own separate chunk, and the outer element's chunk only
// contains its own direct/inline text (not the nested block's text).
func ExtractParagraphs(htmlContent string) ([]Paragraph, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("parsing html: %w", err)
	}

	var paragraphs []Paragraph
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && blockAtoms[n.DataAtom] {
			text := strings.TrimSpace(collectOwnText(n))
			if text != "" {
				paragraphs = append(paragraphs, Paragraph{
					Index:         len(paragraphs),
					Tag:           n.Data,
					Text:          text,
					ParagraphTags: extractDataTags(n),
				})
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)

	return paragraphs, nil
}

// collectOwnText concatenates text belonging directly to this element,
// descending through inline elements (spans, strong, em, etc.) but stopping
// at any nested block-level element boundary, so nested blocks get their
// own separate Paragraph without duplicating text into the parent.
func collectOwnText(n *html.Node) string {
	var sb strings.Builder
	var visit func(n *html.Node, isRoot bool)
	visit = func(n *html.Node, isRoot bool) {
		if !isRoot && n.Type == html.ElementNode && blockAtoms[n.DataAtom] {
			return // nested block element: handled as its own paragraph
		}
		if n.Type == html.TextNode {
			sb.WriteString(n.Data)
			sb.WriteString(" ")
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			visit(c, false)
		}
	}
	visit(n, true)
	return strings.Join(strings.Fields(sb.String()), " ")
}

// extractDataTags reads the "data-tags" attribute (comma-separated list, as
// written by the ParagraphTags TipTap extension) from an element.
func extractDataTags(n *html.Node) []string {
	for _, attr := range n.Attr {
		if attr.Key == "data-tags" {
			return splitTags(attr.Val)
		}
	}
	return nil
}

func splitTags(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
