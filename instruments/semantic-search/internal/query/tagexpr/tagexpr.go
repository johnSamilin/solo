// Package tagexpr implements a small boolean expression language over a set
// of tags, supporting AND / OR / NOT and parentheses, e.g.:
//
//	foo AND (bar OR baz)
//	NOT archived AND project/alpha
//
// Tag matching is segment-based over the hierarchical tag paths: an atom
// matches a tag when it equals the whole tag, equals one of the tag's
// "/"-separated path segments, or is a path-prefix of the tag (so the atom
// "foo" matches "foo/bar" but NOT "foobar", and the atom "ли" matches the
// tag "ли" but NOT "мысли"). This avoids the false positives that a naive
// substring match would produce on word boundaries.
package tagexpr

import (
	"fmt"
	"strings"
)

// Expr is a parsed boolean tag expression that can be evaluated against a
// set of tags.
type Expr interface {
	// Eval reports whether the given tag set satisfies this expression.
	// Matching is case-insensitive and segment-based over the hierarchical
	// tag paths: an atom matches a tag when it equals the whole tag, equals
	// one of the tag's "/"-separated segments, or appears as a contiguous
	// run of whole segments within it (see tagMatches).
	Eval(tags []string) bool
	// String renders the expression back to a canonical textual form,
	// mostly useful for debugging/tests.
	String() string
}

// Parse parses a boolean tag expression. An empty (or whitespace-only)
// input string returns a nil Expr and no error; callers should treat a nil
// Expr as "no filter" (always matches).
func Parse(input string) (Expr, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, nil
	}
	toks, err := tokenize(input)
	if err != nil {
		return nil, err
	}
	p := &parser{tokens: toks}
	expr, err := p.parseOr()
	if err != nil {
		return nil, err
	}
	if p.pos != len(p.tokens) {
		return nil, fmt.Errorf("unexpected token %q at position %d", p.tokens[p.pos].text, p.pos)
	}
	return expr, nil
}

// --- AST node types ---------------------------------------------------

type atomExpr struct {
	value string
}

func (a *atomExpr) Eval(tags []string) bool {
	needle := strings.ToLower(a.value)
	for _, t := range tags {
		if tagMatches(strings.ToLower(t), needle) {
			return true
		}
	}
	return false
}

// tagMatches reports whether the (already lower-cased) hierarchical tag path
// matches the (already lower-cased) atom. Matching is segment-based over the
// "/"-separated tag path rather than a naive substring test, so that:
//
//   - "foo" matches "foo", "foo/bar" and "a/foo/b" (whole segments), but
//   - "foo" does NOT match "foobar" or "barfoo" (no partial-word matches),
//   - "ли" matches "ли" but NOT "мысли".
//
// A multi-segment atom (e.g. "foo/bar") matches when it appears as a
// contiguous run of whole segments within the tag path.
func tagMatches(tag, atom string) bool {
	if atom == "" {
		return false
	}
	if tag == atom {
		return true
	}

	tagSegs := strings.Split(tag, "/")
	atomSegs := strings.Split(atom, "/")
	if len(atomSegs) > len(tagSegs) {
		return false
	}

	for start := 0; start+len(atomSegs) <= len(tagSegs); start++ {
		matched := true
		for i, seg := range atomSegs {
			if tagSegs[start+i] != seg {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func (a *atomExpr) String() string { return a.value }

type notExpr struct {
	operand Expr
}

func (n *notExpr) Eval(tags []string) bool { return !n.operand.Eval(tags) }
func (n *notExpr) String() string          { return "NOT " + wrapIfNeeded(n.operand) }

type andExpr struct {
	left, right Expr
}

func (a *andExpr) Eval(tags []string) bool { return a.left.Eval(tags) && a.right.Eval(tags) }
func (a *andExpr) String() string {
	return wrapIfNeeded(a.left) + " AND " + wrapIfNeeded(a.right)
}

type orExpr struct {
	left, right Expr
}

func (o *orExpr) Eval(tags []string) bool { return o.left.Eval(tags) || o.right.Eval(tags) }
func (o *orExpr) String() string {
	return wrapIfNeeded(o.left) + " OR " + wrapIfNeeded(o.right)
}

func wrapIfNeeded(e Expr) string {
	switch e.(type) {
	case *andExpr, *orExpr:
		return "(" + e.String() + ")"
	default:
		return e.String()
	}
}

// --- Tokenizer ----------------------------------------------------------

type tokenKind int

const (
	tokAtom tokenKind = iota
	tokAnd
	tokOr
	tokNot
	tokLParen
	tokRParen
)

type token struct {
	kind tokenKind
	text string
}

func tokenize(input string) ([]token, error) {
	var toks []token
	var cur strings.Builder

	flush := func() {
		if cur.Len() == 0 {
			return
		}
		word := cur.String()
		cur.Reset()
		switch strings.ToUpper(word) {
		case "AND":
			toks = append(toks, token{kind: tokAnd, text: word})
		case "OR":
			toks = append(toks, token{kind: tokOr, text: word})
		case "NOT":
			toks = append(toks, token{kind: tokNot, text: word})
		default:
			toks = append(toks, token{kind: tokAtom, text: word})
		}
	}

	for _, r := range input {
		switch {
		case r == '(':
			flush()
			toks = append(toks, token{kind: tokLParen, text: "("})
		case r == ')':
			flush()
			toks = append(toks, token{kind: tokRParen, text: ")"})
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
			flush()
		default:
			cur.WriteRune(r)
		}
	}
	flush()

	if len(toks) == 0 {
		return nil, fmt.Errorf("empty tag expression")
	}
	return toks, nil
}

// --- Recursive-descent parser -------------------------------------------
//
// Grammar (lowest to highest precedence):
//
//	or_expr   := and_expr (OR and_expr)*
//	and_expr  := not_expr (AND not_expr)*
//	not_expr  := NOT not_expr | primary
//	primary   := ATOM | '(' or_expr ')'

type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() (token, bool) {
	if p.pos >= len(p.tokens) {
		return token{}, false
	}
	return p.tokens[p.pos], true
}

func (p *parser) next() (token, bool) {
	t, ok := p.peek()
	if ok {
		p.pos++
	}
	return t, ok
}

func (p *parser) parseOr() (Expr, error) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	for {
		t, ok := p.peek()
		if !ok || t.kind != tokOr {
			break
		}
		p.pos++
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		left = &orExpr{left: left, right: right}
	}
	return left, nil
}

func (p *parser) parseAnd() (Expr, error) {
	left, err := p.parseNot()
	if err != nil {
		return nil, err
	}
	for {
		t, ok := p.peek()
		if !ok || t.kind != tokAnd {
			break
		}
		p.pos++
		right, err := p.parseNot()
		if err != nil {
			return nil, err
		}
		left = &andExpr{left: left, right: right}
	}
	return left, nil
}

func (p *parser) parseNot() (Expr, error) {
	t, ok := p.peek()
	if ok && t.kind == tokNot {
		p.pos++
		operand, err := p.parseNot()
		if err != nil {
			return nil, err
		}
		return &notExpr{operand: operand}, nil
	}
	return p.parsePrimary()
}

func (p *parser) parsePrimary() (Expr, error) {
	t, ok := p.next()
	if !ok {
		return nil, fmt.Errorf("unexpected end of expression")
	}
	switch t.kind {
	case tokAtom:
		return &atomExpr{value: t.text}, nil
	case tokLParen:
		expr, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		closing, ok := p.next()
		if !ok || closing.kind != tokRParen {
			return nil, fmt.Errorf("expected closing ')'")
		}
		return expr, nil
	default:
		return nil, fmt.Errorf("unexpected token %q", t.text)
	}
}
