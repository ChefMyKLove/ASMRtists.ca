import os

output = []

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '.cloude', '.obsidian']]
    for file in files:
        if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.py', '.json', '.md')):
            path = os.path.join(root, file)
            output.append(f"\n\n=== {path} ===\n")
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    output.append(f.read())
            except UnicodeDecodeError:
                # Skip weirdly-encoded files instead of crashing
                output.append('[[Skipped file due to encoding issues]]')

with open('codebase.txt', 'w', encoding='utf-8') as out:
    out.write(''.join(output))