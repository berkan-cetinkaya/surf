// Package surf provides helpers for generating SURF patch responses.
package surf

import (
	"fmt"
	"html"
	"strings"
)

// Surface represents a single surface update in a patch.
type Surface struct {
	Target  string
	Content string
}

// Patch represents a SURF patch response containing multiple surface updates.
type Patch struct {
	surfaces []Surface
}

// NewPatch creates a new empty patch.
func NewPatch() *Patch {
	return &Patch{
		surfaces: make([]Surface, 0),
	}
}

// AddSurface adds a surface update to the patch.
// Target should be a CSS selector (e.g., "#main" or ".sidebar").
// Content is the raw HTML to insert into the surface.
func (p *Patch) AddSurface(target, content string) *Patch {
	p.surfaces = append(p.surfaces, Surface{
		Target:  target,
		Content: content,
	})
	return p
}

// Render generates the final patch HTML response.
func (p *Patch) Render() string {
	if len(p.surfaces) == 0 {
		return "<d-patch></d-patch>"
	}

	var sb strings.Builder
	sb.WriteString("<d-patch>\n")

	for _, s := range p.surfaces {
		sb.WriteString(fmt.Sprintf("  <surface target=\"%s\">%s</surface>\n",
			html.EscapeString(s.Target),
			s.Content,
		))
	}

	sb.WriteString("</d-patch>")
	return sb.String()
}

// String implements the Stringer interface.
func (p *Patch) String() string {
	return p.Render()
}

// ContentType returns the appropriate Content-Type header for patch responses.
func ContentType() string {
	return "text/html; charset=utf-8"
}

// Example usage:
//
//	patch := surf.NewPatch().
//		AddSurface("#main", "<h1>Updated Content</h1>").
//		AddSurface("#toast", "<div class='toast'>Saved!</div>")
//
//	w.Header().Set("Content-Type", surf.ContentType())
//	w.Write([]byte(patch.Render()))
