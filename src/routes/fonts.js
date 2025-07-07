import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = express.Router();
const execAsync = promisify(exec);

// システムフォント一覧を取得
router.get('/', async (req, res) => {
  try {
    console.log('📝 システムフォント一覧を取得中...');
    
    // fc-listコマンドでシステムフォントを取得（ファミリーとスタイル両方）
    const { stdout } = await execAsync('fc-list : family style | sort | uniq');
    
    // フォント名を解析
    const fontLines = stdout.trim().split('\n');
    const fontMap = new Map();
    
    for (const line of fontLines) {
      if (line.trim()) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const familyPart = parts[0];
          const stylePart = parts[1].replace('style=', '');
          
          // ファミリー名（最初のもの）
          const fontFamily = familyPart.split(',')[0].trim();
          
          // スタイル（最初のもの）
          const fontStyle = stylePart.split(',')[0].trim();
          
          // 基本的なフォントのみフィルタリング
          if (fontFamily && 
              !fontFamily.includes('.') && 
              !fontFamily.includes('LastResort') &&
              !fontFamily.includes('Symbol') &&
              fontFamily.length < 50) {
            
            if (!fontMap.has(fontFamily)) {
              fontMap.set(fontFamily, {
                name: fontFamily,
                displayName: fontFamily,
                styles: []
              });
            }
            
            const font = fontMap.get(fontFamily);
            if (fontStyle && !font.styles.includes(fontStyle)) {
              font.styles.push(fontStyle);
            }
          }
        }
      }
    }
    
    // フォント配列に変換してソート
    const fonts = Array.from(fontMap.values());
    fonts.sort((a, b) => a.name.localeCompare(b.name));
    
    // 各フォントのスタイルもソート
    fonts.forEach(font => {
      font.styles.sort((a, b) => {
        // Regular/Normalを最初に
        if (a.includes('Regular') || a.includes('Normal')) return -1;
        if (b.includes('Regular') || b.includes('Normal')) return 1;
        return a.localeCompare(b);
      });
    });
    
    console.log(`✅ ${fonts.length}個のシステムフォントを検出`);
    
    res.json({
      success: true,
      fonts: fonts
    });
    
  } catch (error) {
    console.error('❌ システムフォント取得エラー:', error);
    
    // エラー時はデフォルトフォントを返す
    const defaultFonts = [
      { name: 'Arial', displayName: 'Arial', styles: ['Regular', 'Bold', 'Italic', 'Bold Italic'] },
      { name: 'Times New Roman', displayName: 'Times New Roman', styles: ['Regular', 'Bold', 'Italic', 'Bold Italic'] },
      { name: 'Courier New', displayName: 'Courier New', styles: ['Regular', 'Bold', 'Italic', 'Bold Italic'] },
      { name: 'Helvetica', displayName: 'Helvetica', styles: ['Regular', 'Bold', 'Oblique', 'Bold Oblique'] },
      { name: 'Georgia', displayName: 'Georgia', styles: ['Regular', 'Bold', 'Italic', 'Bold Italic'] },
      { name: 'Impact', displayName: 'Impact', styles: ['Regular'] }
    ];
    
    res.json({
      success: true,
      fonts: defaultFonts,
      fallback: true
    });
  }
});

export { router as fontsRouter };