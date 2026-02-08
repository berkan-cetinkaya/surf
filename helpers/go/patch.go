package surf

import (
	"fmt"
	"strings"
)

// Patch represents a SURF patch response
type Patch struct {
	surfaces []surfaceUpdate
}

type surfaceUpdate struct {
	Target  string
	Content string
}

// NewPatch creates a new Patch
func NewPatch() *Patch {
	return &Patch{
		surfaces: make([]surfaceUpdate, 0),
	}
}

// AddSurface adds a surface update to the patch
func (p *Patch) AddSurface(target, content string) *Patch {
	p.surfaces = append(p.surfaces, surfaceUpdate{
		Target:  target,
		Content: content,
	})
	return p
}

// Render generates the HTML for the patch
func (p *Patch) Render() string {
	if len(p.surfaces) == 0 {
		return "<d-patch></d-patch>"
	}

	var sb strings.Builder
	sb.WriteString("<d-patch>\n")

	for _, s := range p.surfaces {
		sb.WriteString(fmt.Sprintf("  <surface target=\"%s\">%s</surface>\n", escapeHtml(s.Target), s.Content))
	}

	sb.WriteString("</d-patch>")
	return sb.String()
}

func escapeHtml(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "&", "&amp;"), "\"", "&quot;")
}
