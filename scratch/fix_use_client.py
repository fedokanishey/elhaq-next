import os

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            p = os.path.join(root, file)
            with open(p, 'r', encoding='utf-8') as f:
                content = f.read()
            if '"use client";' in content or "'use client';" in content:
                directive = '"use client";\n'
                # check if it starts with the directive
                if not content.startswith('"use client";') and not content.startswith("'use client';"):
                    # remove occurrences of the directive
                    cleaned = content.replace('"use client";\n', '').replace('"use client";', '')
                    cleaned = cleaned.replace("'use client';\n", '').replace("'use client';", '')
                    new_content = directive + cleaned.lstrip()
                    with open(p, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed directive in {p}')

