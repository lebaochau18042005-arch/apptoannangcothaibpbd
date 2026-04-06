import JSZip from 'jszip';
import mammoth from 'mammoth';
import { UploadedFile } from '../types';

export interface DocxParseResult {
  text: string;
  images: UploadedFile[];
  method: 'xml' | 'mammoth' | 'hybrid';
  wmfCount: number;
}

/**
 * Trích xuất nội dung DOCX bao gồm cả Text, hình ảnh, OMML và MathType (WMF -> PNG)
 */
export async function parseDocxWithMath(file: File): Promise<DocxParseResult | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // BƯỚC 1: MAMMOTH convert để lấy TẤT CẢ HÌNH ẢNH (bao gồm WMF đã thành PNG)
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) });
    const html = result.value;
    
    const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/jpg'];
    const imgRegex = /<img[^>]+src=["']data:([^;]+);base64,([^"']+)["'][^>]*>/gi;
    const extractedImages: UploadedFile[] = [];
    let match: RegExpExecArray | null;
    let imgIndex = 0;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const mimeType = match[1].toLowerCase();
      // Bỏ qua định dạng không hỗ trợ cho Gemini
      if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) continue;
      imgIndex++;
      extractedImages.push({
        name: `${file.name} (hình ${imgIndex})`,
        base64: match[2],
        mimeType: mimeType,
        size: Math.round(match[2].length * 0.75),
      });
    }

    // fallback html text
    let mammothText = html
      .replace(/<img[^>]*>/gi, ' [HÌNH_ẢNH] ')
      .replace(/<[^>]+>/g, '')         
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // BƯỚC 2: JSZIP parse XML để lấy Text và cấu trúc OMML
    let xmlText = '';
    let wmfCount = 0;
    let method: 'xml' | 'mammoth' | 'hybrid' = 'mammoth';

    try {
      const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
      
      // Đếm file wmf trong word/media/
      Object.keys(zip.files).forEach(filename => {
        if (filename.startsWith('word/media/') && filename.toLowerCase().endsWith('.wmf')) {
          wmfCount++;
        }
      });

      const docXmlFile = zip.file('word/document.xml');
      if (docXmlFile) {
        const docXmlText = await docXmlFile.async('text');
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXmlText, "text/xml");
        
        xmlText = extractTextFromOOXML(xmlDoc.documentElement);
        
        if (xmlText.trim()) {
          method = wmfCount > 0 ? 'hybrid' : 'xml';
        }
      }
    } catch (e) {
      console.warn("XML Extraction failed, falling back to mammoth text only", e);
    }

    const finalText = (method === 'hybrid' || method === 'xml') && xmlText.trim() ? xmlText : mammothText;

    if (!finalText) {
      console.warn(`File "${file.name}" không có nội dung text.`);
      return null;
    }

    console.log(`[DocxMathParser] Processed ${file.name} using ${method}. Found ${wmfCount} WMFs, ${extractedImages.length} images extracted.`);
    
    return {
      text: finalText,
      images: extractedImages,
      method,
      wmfCount
    };

  } catch (error) {
    console.error("Error in parseDocxWithMath:", error);
    return null;
  }
}

function extractTextFromOOXML(node: Element): string {
    let result = '';
    
    const childNodes = Array.from(node.children);
    
    for (const child of childNodes) {
        const tag = child.tagName;
        
        if (tag === 'w:p') {
            result += extractTextFromOOXML(child) + '\n\n';
        } 
        else if (tag === 'w:r' || tag === 'w:t') {
            if (tag === 'w:t') {
                result += child.textContent || '';
            } else {
                result += extractTextFromOOXML(child);
            }
        }
        else if (tag === 'm:oMathPara' || tag === 'm:oMath') {
            result += ` $${ommlToLatex(child)}$ `;
        }
        else if (tag === 'w:tbl') {
            result += '\n\n[BẢNG_DỮ_LIỆU]\n' + extractTextFromOOXML(child) + '\n[/BẢNG_DỮ_LIỆU]\n\n';
        }
        else if (tag === 'w:tc') {
            result += extractTextFromOOXML(child) + ' | ';
        }
        else if (tag === 'w:tr') {
            result += extractTextFromOOXML(child) + '\n';
        }
        else {
            result += extractTextFromOOXML(child);
        }
    }
    
    return result;
}

function ommlToLatex(node: Element): string {
    let result = '';
    for (const child of Array.from(node.children)) {
        const tag = child.tagName;
        
        if (tag === 'm:f') {
            const num = child.getElementsByTagName('m:num')[0];
            const den = child.getElementsByTagName('m:den')[0];
            const numLatex = num ? ommlToLatex(num) : '';
            const denLatex = den ? ommlToLatex(den) : '';
            result += `\\frac{${numLatex}}{${denLatex}}`;
        } else if (tag === 'm:sSup') {
            const e = child.getElementsByTagName('m:e')[0];
            const sup = child.getElementsByTagName('m:sup')[0];
            result += `${e ? ommlToLatex(e) : ''}^{${sup ? ommlToLatex(sup) : ''}}`;
        } else if (tag === 'm:sSub') {
            const e = child.getElementsByTagName('m:e')[0];
            const sub = child.getElementsByTagName('m:sub')[0];
            result += `${e ? ommlToLatex(e) : ''}_{${sub ? ommlToLatex(sub) : ''}}`;
        } else if (tag === 'm:sSubSup') {
            const e = child.getElementsByTagName('m:e')[0];
            const sub = child.getElementsByTagName('m:sub')[0];
            const sup = child.getElementsByTagName('m:sup')[0];
            result += `${e ? ommlToLatex(e) : ''}_{${sub ? ommlToLatex(sub) : ''}}^{${sup ? ommlToLatex(sup) : ''}}`;
        } else if (tag === 'm:rad') {
            const deg = child.getElementsByTagName('m:deg')[0];
            const e = child.getElementsByTagName('m:e')[0];
            if (deg && deg.textContent?.trim()) {
                result += `\\sqrt[${ommlToLatex(deg)}]{${e ? ommlToLatex(e) : ''}}`;
            } else {
                result += `\\sqrt{${e ? ommlToLatex(e) : ''}}`;
            }
        } else if (tag === 'm:t') {
            result += child.textContent || '';
        } else if (tag === 'w:t') {
             // Đôi khi có w:t bên trong Math
            result += child.textContent || '';
        } else if (child.children.length > 0) {
            result += ommlToLatex(child);
        }
    }
    
    // Clean up spaces 
    return result.replace(/\s+/g, ' ').trim();
}
