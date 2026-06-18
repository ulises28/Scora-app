import sys

with open('src/features/editor/StickerRegistry.ts', 'r') as f:
    content = f.read()

# Replace all supportsCustomColor: true, with nothing
content = content.replace("supportsCustomColor: true, ", "")

# Now add it back for the specific ones
allowed = ['graffiti-expo', 'graffiti-map', 'thin-path', 'condesa-stack', 'stacked-editorial']

for a in allowed:
    content = content.replace(f"id: '{a}', ", f"id: '{a}', supportsCustomColor: true, ")

with open('src/features/editor/StickerRegistry.ts', 'w') as f:
    f.write(content)
