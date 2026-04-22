#!/usr/bin/env python3
"""Verify transparent logos by compositing on a colored background."""
from PIL import Image
import os

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'company-logos')
OUT_DIR = '/tmp/logo-verify'
os.makedirs(OUT_DIR, exist_ok=True)

logos = ['10beauty.png', 'cofertility.png', 'feno.png', 'jacobbar.png', 
         'rhythmscience.png', 'magicstory.png', 'recess.png', 
         'sipmargs.png', 'skylark.png', 'snapfix.png']

for logo in logos:
    path = os.path.join(LOGO_DIR, logo)
    if not os.path.exists(path):
        print(f"SKIP: {logo}")
        continue
    
    img = Image.open(path).convert('RGBA')
    
    # Count transparent pixels
    pixels = list(img.getdata())
    transparent = sum(1 for p in pixels if p[3] == 0)
    semi = sum(1 for p in pixels if 0 < p[3] < 255)
    opaque = sum(1 for p in pixels if p[3] == 255)
    total = len(pixels)
    
    print(f"{logo}: transparent={transparent} ({transparent*100//total}%), semi={semi}, opaque={opaque} ({opaque*100//total}%)")
    
    # Composite on white background to see how it looks
    white_bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
    white_bg.paste(img, (0, 0), img)
    white_bg.convert('RGB').save(os.path.join(OUT_DIR, f'white_{logo.replace(".png",".jpg")}'), 'JPEG')

print(f"\nVerification images saved to {OUT_DIR}")
