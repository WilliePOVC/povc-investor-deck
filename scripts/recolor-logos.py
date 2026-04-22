#!/usr/bin/env python3
"""
Recolor transparent PNG logos to #292929 monochrome.
Creates a -mono.png version of each logo where all non-transparent pixels
are replaced with #292929, preserving the alpha channel.
Also creates a copy of the original as -color.png for hover state.
"""
from PIL import Image
import os

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'coinvestor-logos')
TARGET_COLOR = (41, 41, 41)  # #292929

def recolor_to_mono(input_path, mono_path):
    """Replace all non-transparent pixels with #292929."""
    img = Image.open(input_path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    for x in range(w):
        for y in range(h):
            r, g, b, a = pixels[x, y]
            if a > 0:  # Non-transparent pixel
                pixels[x, y] = (TARGET_COLOR[0], TARGET_COLOR[1], TARGET_COLOR[2], a)
    
    img.save(mono_path, 'PNG')
    return True

logos = [
    'upfront.png',
    'palm-tree-crew.png',
    'bam-ventures.png',
    'bold-capital.png',
    'lerer-hippeau.png',
    'red-sea-ventures.png',
    'jump-capital.png',
    'bbg-ventures.png',
    'courtside-vc.png',
    'next-ventures.png',
    'initialized.png',
    'offline-ventures.png',
    'point72-ventures.png',
]

for logo in logos:
    input_path = os.path.join(LOGO_DIR, logo)
    if not os.path.exists(input_path):
        print(f'SKIP: {logo} not found')
        continue
    
    # Save original as -color version
    color_name = logo.replace('.png', '-color.png')
    color_path = os.path.join(LOGO_DIR, color_name)
    
    img = Image.open(input_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    img.save(color_path, 'PNG')
    
    # Create monochrome version (overwrite original filename)
    mono_path = input_path  # overwrite the main file
    print(f'Processing {logo}...')
    recolor_to_mono(color_path, mono_path)
    print(f'  ✅ Mono: {logo}, Color backup: {color_name}')

print('\nDone! Mono versions saved as main files, color backups as *-color.png')
