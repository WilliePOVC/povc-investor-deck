#!/usr/bin/env python3
"""Create clean SVG text logos for GP credential pills."""
import os

OUT = '/data/.openclaw/workspace/povc-investor-deck/assets/gp-logos'
os.makedirs(OUT, exist_ok=True)

# Willie's logos
logos = {
    # name: (display text, width, font-size, font-weight, font-family)
    'duke': ('Duke', 100, 28, '700', "'Georgia', serif"),
    'ucla-anderson': ('UCLA Anderson', 220, 18, '700', "'Helvetica Neue', sans-serif"),
    'squadup': ('squadup', 160, 24, '800', "'Helvetica Neue', sans-serif"),
    'trialtech': ('TrialTech', 170, 22, '700', "'Helvetica Neue', sans-serif"),
    'instill': ('instill', 120, 24, '500', "'Georgia', serif"),
    'share-ventures': ('Share Ventures', 220, 18, '600', "'Helvetica Neue', sans-serif"),
    'puravida': ('puravida', 160, 20, '700', "'Helvetica Neue', sans-serif"),
    'teamworthy': ('Teamworthy', 190, 20, '400', "'Georgia', serif"),
    # Sean's logos
    'cornell-hotel': ('Cornell Hotel School', 280, 16, '500', "'Georgia', serif"),
    'world-travel': ('World Travel Holdings', 300, 16, '600', "'Helvetica Neue', sans-serif"),
    'cruiseline': ('Cruiseline.com', 220, 18, '700', "'Georgia', serif"),
    'shipmate': ('Shipmate', 150, 22, '700', "'Helvetica Neue', sans-serif"),
    'resortforaday': ('Resort For A Day', 240, 16, '600', "'Georgia', serif"),
}

for name, (text, width, size, weight, family) in logos.items():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 40" width="{width}" height="40">
  <text x="{width//2}" y="28" text-anchor="middle" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="#292929">{text}</text>
</svg>'''
    path = os.path.join(OUT, f'{name}.svg')
    with open(path, 'w') as f:
        f.write(svg)
    print(f'✅ {name}.svg')

print('\nDone!')
