const fs = require('fs');
const path = './src/features/editor/CanvasPainter.ts';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('// ─── MICRO-FOOTPRINT STICKERS');
if (startIndex !== -1) {
    let block = content.substring(startIndex);
    
    // Global replacements inside the block
    block = block.replace(/ctx\.fillStyle = '#ffffff';/g, "ctx.fillStyle = textColor;");
    block = block.replace(/ctx\.strokeStyle = '#ffffff';/g, "ctx.strokeStyle = textColor;");
    block = block.replace(/ctx\.fillStyle = 'rgba\\(255,255,255,0\\.9\\)';/g, "ctx.fillStyle = textColor; ctx.globalAlpha = 0.9;");
    block = block.replace(/ctx\.fillStyle = 'rgba\\(255,255,255,0\\.6\\)';/g, "ctx.fillStyle = textColor; ctx.globalAlpha = 0.6;");
    block = block.replace(/ctx\.fillStyle = 'rgba\\(255,255,255,0\\.8\\)';/g, "ctx.fillStyle = textColor; ctx.globalAlpha = 0.8;");
    
    // specific fixes for opacity
    block = block.replace(/ctx\.fillText\\(/g, "ctx.fillText("); // Just checking where it's used
    
    // We need to restore globalAlpha after setting it
    block = block.replace(/ctx\.globalAlpha = (0\\.[0-9]);\\n([\\s\\S]*?)(?=ctx\\.)/g, "ctx.globalAlpha = $1;\n$2ctx.globalAlpha = 1.0;\n");
    
    // For the pink color, leave it or use accent? Let's leave pink.
    
    // For Scora tag @scora_app which has black on white bg:
    // If textColor is black, maybe it should be white on black?
    // Let's just use textColor for the text.
    
    content = content.substring(0, startIndex) + block;
    fs.writeFileSync(path, content, 'utf8');
    console.log("Updated!");
} else {
    console.log("Not found");
}
