"""Fix xai-intrusion-detection-system src stub files:
- Strip UTF-8 BOM if present
- Unescape backslash-quote sequences (\"\"\" -> \"\"\")
"""
import os
import glob

src = r'd:\PROJECTS\Collage_Projects\ML_Project\xai-intrusion-detection-system\src'
fixed = 0

for fpath in glob.glob(os.path.join(src, '**', '*.py'), recursive=True):
    # Read as binary to check BOM
    with open(fpath, 'rb') as f:
        raw = f.read()
    
    # Strip UTF-8 BOM (0xEF 0xBB 0xBF)
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]
        print(f'Stripped BOM: {os.path.basename(fpath)}')
        fixed += 1
    
    # Decode
    try:
        content = raw.decode('utf-8')
    except Exception:
        content = raw.decode('latin-1')
    
    # Check for escaped quotes at start (files saved with JSON escaping)
    if content[:2] == '\\"' or content[:4] == '\\"\\"\\"':
        new_content = content.replace('\\"', '"')
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed escaped quotes: {os.path.basename(fpath)}')
        fixed += 1
        continue
    
    # Check if ends-result was already correct (after BOM strip)
    if raw[:3] == b'\xef\xbb\xbf':
        with open(fpath, 'wb') as f:
            f.write(raw)

print(f'\nTotal operations: {fixed}')
