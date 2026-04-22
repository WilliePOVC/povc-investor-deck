#!/usr/bin/env python3
"""Remove beige/tan backgrounds from company logos and make them transparent."""

from PIL import Image
import os
import sys

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'company-logos')

def remove_background(input_path, output_path, tolerance=60):
    """Remove background color (beige/tan) from image, making it transparent."""
    img = Image.open(input_path).convert('RGBA')
    pixels = img.load()
    width, height = img.size
    
    # Sample corner pixels to determine background color
    corners = []
    sample_size = 5
    for x in range(sample_size):
        for y in range(sample_size):
            corners.append(pixels[x, y][:3])
            corners.append(pixels[width-1-x, y][:3])
            corners.append(pixels[x, height-1-y][:3])
            corners.append(pixels[width-1-x, height-1-y][:3])
    
    # Average the corner colors to get background color
    bg_r = sum(c[0] for c in corners) // len(corners)
    bg_g = sum(c[1] for c in corners) // len(corners)
    bg_b = sum(c[2] for c in corners) // len(corners)
    
    print(f"  Detected background color: RGB({bg_r}, {bg_g}, {bg_b})")
    
    # Make matching pixels transparent
    changed = 0
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            # Check if pixel is close to background color
            if (abs(r - bg_r) < tolerance and 
                abs(g - bg_g) < tolerance and 
                abs(b - bg_b) < tolerance):
                pixels[x, y] = (r, g, b, 0)  # Make transparent
                changed += 1
    
    total = width * height
    pct = (changed / total) * 100
    print(f"  Made {changed}/{total} pixels transparent ({pct:.1f}%)")
    
    img.save(output_path, 'PNG')
    print(f"  Saved: {output_path}")

def main():
    logos = [
        '10beauty.png',
        'cofertility.png', 
        'feno.jpg',
        'jacobbar.jpg',
        'rhythmscience.jpg',
        'magicstory.jpg',
        'recess.jpg',
        'sipmargs.jpg',
        'skylark.jpg',
        'snapfix.jpg',
    ]
    
    for logo in logos:
        input_path = os.path.join(LOGO_DIR, logo)
        if not os.path.exists(input_path):
            print(f"SKIP: {logo} not found")
            continue
        
        # Output always as PNG (for transparency)
        output_name = os.path.splitext(logo)[0] + '.png'
        output_path = os.path.join(LOGO_DIR, output_name)
        
        print(f"\nProcessing: {logo}")
        remove_background(input_path, output_path, tolerance=45)
        
        # Remove old JPG if we converted to PNG
        if logo.endswith('.jpg') and os.path.exists(input_path):
            os.remove(input_path)
            print(f"  Removed old: {logo}")

if __name__ == '__main__':
    main()
