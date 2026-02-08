# SURF Brand Color Palettes

25 carefully curated color schemes for developer tools & frameworks.

## Dark Palettes (1-15)

| # | Name | Primary Accent | Vibe |
|---|------|----------------|------|
| 01 | **Midnight Ocean** | `#00b4d8` Cyan | Deep blues, calming, professional |
| 02 | **Neon Synthwave** | `#ff0080` Pink | Retro-futuristic, bold, energetic |
| 03 | **Forest Night** | `#4caf50` Green | Natural, calming, eco-friendly |
| 04 | **Ember Glow** | `#ff9800` Orange | Warm, energetic, inviting |
| 05 | **Electric Violet** | `#8b5cf6` Purple | Modern tech, creative, bold |
| 06 | **Arctic Aurora** | `#22d3ee` Cyan | Cool, fresh, futuristic |
| 07 | **Rose Gold Dark** | `#f472b6` Pink | Elegant, premium, sophisticated |
| 08 | **Obsidian Gold** | `#d4af37` Gold | Luxury, premium, exclusive |
| 09 | **Crimson Night** | `#ef4444` Red | Bold, urgent, powerful |
| 10 | **Quantum Blue** | `#388bfd` Blue | IBM-style, professional, trustworthy |
| 11 | **Cosmic Purple** | `#a78bfa` Lavender | Space-inspired, dreamy, creative |
| 12 | **Matrix Green** | `#22c55e` Green | Hacker aesthetic, techy, edgy |
| 13 | **Slate Storm** | `#64748b` Gray | Neutral, professional, minimal |
| 14 | **Sunset Blaze** | `#fb923c` Orange | Warm gradient, vibrant, energetic |
| 15 | **Deep Space** | `#6366f1` Indigo | Almost black, mysterious, premium |

## Light Palettes (16-20)

| # | Name | Primary Accent | Vibe |
|---|------|----------------|------|
| 16 | **Clean Slate** | `#2563eb` Blue | Minimal, clean, professional |
| 17 | **Warm Paper** | `#b45309` Brown | Soft, organic, readable |
| 18 | **Fresh Mint** | `#16a34a` Green | Clean, fresh, eco-friendly |
| 19 | **Sky Blue** | `#0ea5e9` Blue | Light, airy, trustworthy |
| 20 | **Lavender Mist** | `#9333ea` Purple | Soft, creative, elegant |

## Inspired By (21-25)

| # | Name | Primary Accent | Inspiration |
|---|------|----------------|-------------|
| 21 | **Vercel** | `#ffffff` White | vercel.com - clean monochrome |
| 22 | **Linear** | `#5e6ad2` Purple | linear.app - gradient magic |
| 23 | **Stripe** | `#00d4ff` Cyan | stripe.com - blue focus |
| 24 | **Discord** | `#5865f2` Blurple | discord.com - friendly tech |
| 25 | **GitHub Dark** | `#58a6ff` Blue | github.com - familiar developer |

---

## Usage

```html
<html class="palette-midnight-ocean">
```

```css
body {
    background: var(--bg-primary);
    color: var(--text-primary);
}

.card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
}

.button {
    background: var(--gradient);
}
```

## Variables Available

Each palette provides:
- `--bg-primary` - Main background
- `--bg-secondary` - Slightly lighter background
- `--bg-surface` - Card/surface background
- `--border` - Border color with opacity
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text
- `--text-muted` - Muted/disabled text
- `--accent-primary` - Main accent color
- `--accent-secondary` - Darker accent
- `--accent-tertiary` - Lighter accent
- `--gradient` - Brand gradient
