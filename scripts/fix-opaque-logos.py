#!/usr/bin/env python3
"""
Fix logos that have opaque white backgrounds.
Step 1: Remove white/near-white background (make transparent)
Step 2: Recolor remaining pixels to #292929
"""
from PIL import Image
import os

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'coinvestor-logos')
TARGET_COLOR = (41, 41, 41)  # #292929
WHITE_TOLERANCE = 30  # pixels within this range of white become transparent

def fix_opaque_logo(color_path, mono_path):
    """Remove white background, then recolor to #292929."""
    img = Image.open(color_path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    # Step 1: Make white/near-white pixels transparent
    for x in range(w):
        for y in range(h):
            r, g, b, a = pixels[x, y]
            if (r > 255 - WHITE_TOLERANCE and 
                g > 255 - WHITE_TOLERANCE and 
                b > 255 - WHITE_TOLERANCE):
                pixels[x, y] = (r, g, b, 0)  # transparent
    
    # Step 2: Recolor remaining non-transparent pixels to #292929
    for x in range(w):
        for y in range(h):
            r, g, b, a = pixels[x, y]
            if a > 0:
                pixels[x, y] = (TARGET_COLOR[0], TARGET_COLOR[1], TARGET_COLOR[2], a)
    
    img.save(mono_path, 'PNG')

logos_to_fix = [
    'palm-tree-crew',
    'bbg-ventures', 
    'courtside-vc',
]

for name in logos_to_fix:
    color_path = os.path.join(LOGO_DIR, f'{name}-color.png')
    mono_path = os.path.join(LOGO_DIR, f'{name}.png')
    
    if not os.path.exists(color_path):
        print(f'SKIP: {name}-color.png not found')
        continue
    
    print(f'Fixing {name}...')
    fix_opaque_logo(color_path, mono_path)
    print(f'  ✅ Fixed: white bg removed, recolored to #292929')

print('\nDone!')
