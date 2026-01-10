const fs = require('fs');
const path = require('path');

// --- Configuration ---
const ICONS_PER_LINE = 15; // 全局变量：控制每行显示的图标数量
// ---------------------

const GRID_SIZE = 300;     // 与原始 index.js 保持一致的栅格大小
const ICON_VIEW_SIZE = 48; // 期望的图标显示大小
const PADDING_OFFSET = 44; // 原始逻辑中的偏移量

const ICONS_DIR = path.resolve(__dirname, '../assets/icons');
const OUTPUT_FILE = path.resolve(__dirname, '../assets/dist/skills.svg');

function main() {
  // 1. 读取图标
  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`Error: Icons directory not found at ${ICONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(ICONS_DIR).filter(file => file.toLowerCase().endsWith('.svg'));
  
  if (files.length === 0) {
    console.warn('Warning: No SVG files found in icons directory.');
    return;
  }

  const iconSvgs = files.map(file => {
    return fs.readFileSync(path.join(ICONS_DIR, file), 'utf-8');
  });

  // 2. 计算尺寸
  const perLine = ICONS_PER_LINE;
  const count = iconSvgs.length;
  
  // 根据原 index.js 逻辑计算宽高
  // length = min(perLine * 300, count * 300) - 44
  const rawWidth = Math.min(perLine * GRID_SIZE, count * GRID_SIZE) - PADDING_OFFSET;
  // height = ceil(count / perLine) * 300 - 44
  const rawHeight = Math.ceil(count / perLine) * GRID_SIZE - PADDING_OFFSET;

  // SCALE = 48 / (300 - 44) ~= 0.1875
  const scale = ICON_VIEW_SIZE / (GRID_SIZE - PADDING_OFFSET);
  
  const width = rawWidth * scale;   // 实际 SVG width 属性
  const height = rawHeight * scale; // 实际 SVG height 属性

  // 3. 生成 SVG 内容
  // viewBox 使用 rawWidth/rawHeight 以保持内部坐标系一致
  const svgContent = `
<svg width="${width}" height="${height}" viewBox="0 0 ${rawWidth} ${rawHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">
  ${iconSvgs.map((svg, index) => {
    const col = index % perLine;
    const row = Math.floor(index / perLine);
    const x = col * GRID_SIZE;
    const y = row * GRID_SIZE;
    
    return `
  <g transform="translate(${x}, ${y})">
    ${svg}
  </g>`;
  }).join('')}
</svg>`;

  // 4. 写入文件
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, svgContent.trim(), 'utf-8');
  console.log(`Successfully generated combined SVG with ${count} icons.`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();
