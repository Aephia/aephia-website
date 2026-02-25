#!/usr/bin/env python3
"""Fix markdown formatting bugs in MDX files."""
import re, glob, os

DIR = '/Users/merlin/Development/Aephia/aephia-website/staratlas/medium'

def fix_content(text):
    # Split frontmatter
    parts = text.split('---', 2)
    if len(parts) < 3:
        return text
    frontmatter = parts[0] + '---' + parts[1] + '---'
    body = parts[2]
    
    # Bug 3: Bold wrapping links - **text [linktext**](url) → **text** [linktext](url)
    body = re.sub(r'\*\*([^*\[]+?)\s*\[([^\]]*?)\*\*\]\(([^)]+)\)', r'**\1** [\2](\3)', body)
    
    # Bug 4: **. ** → . 
    body = body.replace('**. **', '. ')
    
    # Bug 1a: ** text** → **text** (space after opening **)
    # Be careful not to match legitimate patterns
    body = re.sub(r'\*\*\s+(\S)', r'**\1', body)
    
    # Bug 1b: **text ** → **text**  (space before closing **)
    # Match **content ** where content doesn't start with * and space before closing **
    body = re.sub(r'\*\*([^*]+?)\s+\*\*', r'**\1** ', body)
    
    # Clean up: if we created double spaces, reduce
    # But be careful with intentional formatting
    
    # Bug 2: -** at start of line → - **
    body = re.sub(r'^-\*\*', '- **', body, flags=re.MULTILINE)
    
    # Bug 5: Stray trailing * on list items (single * without matching pair)
    def fix_stray_asterisk(line):
        # Only fix lines ending with * that aren't part of ** or a matched pair
        if line.rstrip().endswith('*') and not line.rstrip().endswith('**'):
            stripped = line.rstrip()
            # Check if removing trailing * leaves balanced bold markers
            without_trailing = stripped[:-1]
            # Count single * (not part of **) 
            # Simple: if odd number of standalone *, the trailing one is stray
            temp = without_trailing.replace('**', '')
            if temp.count('*') % 2 == 0:
                return without_trailing + '\n' if line.endswith('\n') else without_trailing
        return line
    
    lines = body.split('\n')
    lines = [fix_stray_asterisk(l) for l in lines]
    body = '\n'.join(lines)
    
    # Bug 6: :** followed by word char → :** + space
    body = re.sub(r':\*\*([A-Za-z0-9])', r':** \1', body)
    
    return frontmatter + body

files = glob.glob(os.path.join(DIR, '*.mdx'))
changed = 0
for f in sorted(files):
    original = open(f).read()
    fixed = fix_content(original)
    if fixed != original:
        open(f, 'w').write(fixed)
        changed += 1
        print(f'Fixed: {os.path.basename(f)}')

print(f'\nTotal: {len(files)} files, {changed} changed')
