import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from "docx";
import { FlashcardGame } from './games/FlashcardGame';
import { QuizGame } from './games/QuizGame';
import { ExamAnalytics } from './ExamAnalytics';
import { LiveMonitor } from './LiveMonitor';
import { parseExamContent, parseAnswersContent } from '../utils/examParser';

// MathJax global
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: { typeset?: boolean };
    };
  }
}

interface ExamDisplayProps {
  examContent: string;                // Đề bài (đã tạo)
  answersContent: string;             // Đáp án (có thể rỗng — chưa tạo)
  onGenerateAnswers: () => void;      // Callback khi user bấm "Tạo đáp án"
  isGeneratingAnswers: boolean;       // Đang tạo đáp án?
  onRegenerateSvg?: (oldSvg: string, questionContext: string, editRequest: string) => Promise<string>;
}

export const ExamDisplay: React.FC<ExamDisplayProps> = ({
  examContent,
  answersContent,
  onGenerateAnswers,
  isGeneratingAnswers,
  onRegenerateSvg,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG Edit state
  const [editingSvg, setEditingSvg] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Game/Analytics state
  const [activeGame, setActiveGame] = useState<'flashcard' | 'quiz' | 'analytics' | 'live-monitor' | null>(null);

  // Trigger MathJax khi content thay đổi
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.MathJax?.typesetPromise && containerRef.current) {
        window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
          console.warn('MathJax typeset error:', err);
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [examContent, answersContent]);

  if (!examContent) return null;

  // ============================================
  // DOWNLOAD WORD
  // ============================================
  const handleDownloadWord = async () => {
    setIsDownloading(true);
    try {
      // Convert LaTeX math → Unicode cho DOCX
      const latexToUnicode = (text: string): string => {
        return text
          // Strip $...$ and $$...$$ delimiters
          .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
          .replace(/\$(.*?)\$/g, '$1')
          // Fractions: \frac{a}{b} → a/b
          .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)')
          // Superscripts
          .replace(/\^{([^}]*)}/g, (_, exp) => {
            const sup: Record<string, string> = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','x':'ˣ','+':'⁺','-':'⁻','(':'⁽',')':'⁾'};
            return exp.split('').map((c: string) => sup[c] || c).join('');
          })
          .replace(/\^(\d)/g, (_, d) => {
            const sup: Record<string, string> = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
            return sup[d] || d;
          })
          // Subscripts
          .replace(/_{([^}]*)}/g, (_, sub) => {
            const subs: Record<string, string> = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','n':'ₙ','i':'ᵢ','k':'ₖ'};
            return sub.split('').map((c: string) => subs[c] || c).join('');
          })
          .replace(/_(\d)/g, (_, d) => {
            const subs: Record<string, string> = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
            return subs[d] || d;
          })
          // Square root
          .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
          .replace(/\\sqrt\s/g, '√')
          // Greek letters
          .replace(/\\alpha/g,'α').replace(/\\beta/g,'β').replace(/\\gamma/g,'γ').replace(/\\delta/g,'δ')
          .replace(/\\epsilon/g,'ε').replace(/\\theta/g,'θ').replace(/\\lambda/g,'λ').replace(/\\mu/g,'μ')
          .replace(/\\pi/g,'π').replace(/\\sigma/g,'σ').replace(/\\phi/g,'φ').replace(/\\omega/g,'ω')
          .replace(/\\Delta/g,'Δ').replace(/\\Sigma/g,'Σ').replace(/\\Omega/g,'Ω').replace(/\\Phi/g,'Φ')
          // Operators & symbols
          .replace(/\\leq/g,'≤').replace(/\\geq/g,'≥').replace(/\\neq/g,'≠').replace(/\\approx/g,'≈')
          .replace(/\\pm/g,'±').replace(/\\mp/g,'∓').replace(/\\times/g,'×').replace(/\\div/g,'÷')
          .replace(/\\cdot/g,'·').replace(/\\infty/g,'∞').replace(/\\in/g,'∈').replace(/\\notin/g,'∉')
          .replace(/\\subset/g,'⊂').replace(/\\cup/g,'∪').replace(/\\cap/g,'∩')
          .replace(/\\forall/g,'∀').replace(/\\exists/g,'∃')
          .replace(/\\Rightarrow/g,'⇒').replace(/\\Leftrightarrow/g,'⇔')
          .replace(/\\rightarrow/g,'→').replace(/\\leftarrow/g,'←')
          .replace(/\\le\b/g,'≤').replace(/\\ge\b/g,'≥').replace(/\\ne\b/g,'≠')
          // Integrals, sums
          .replace(/\\int/g,'∫').replace(/\\sum/g,'Σ').replace(/\\prod/g,'∏').replace(/\\lim/g,'lim')
          // Overline
          .replace(/\\overline\{([^}]*)\}/g, '$1\u0305')
          // Braces & misc
          .replace(/\\left\(/g,'(').replace(/\\right\)/g,')').replace(/\\left\[/g,'[').replace(/\\right\]/g,']')
          .replace(/\\left\\\{/g,'{').replace(/\\right\\\}/g,'}')
          .replace(/\\{/g,'{').replace(/\\}/g,'}')
          .replace(/\\text\{([^}]*)\}/g, '$1')
          .replace(/\\mathrm\{([^}]*)\}/g, '$1')
          .replace(/\\quad/g, '  ').replace(/\\qquad/g, '    ')
          // Strip remaining backslash commands
          .replace(/\\[a-zA-Z]+/g, '')
          // Clean up markdown bold
          .replace(/\*\*/g, '');
      };

      const processText = (text: string): string => latexToUnicode(text);

      const createTableFromMarkdown = (tableLines: string[]): Table => {
        const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
        const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
        const rows: TableRow[] = [];

        for (let i = 0; i < tableLines.length; i++) {
          const line = tableLines[i].trim();
          if (line.match(/^\|[-:\s|]+\|$/)) continue;
          const cells = line.split('|').filter(cell => cell.trim() !== '');
          if (cells.length > 0) {
            const isHeader = i === 0;
            rows.push(new TableRow({
              tableHeader: isHeader,
              children: cells.map(cellText => new TableCell({
                borders,
                width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({
                    text: cellText.trim(),
                    bold: isHeader,
                    size: 22,
                    font: "Times New Roman"
                  })]
                })]
              }))
            }));
          }
        }
        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
      };

      const isTableLine = (line: string): boolean => {
        return line.trim().startsWith('|') && line.trim().endsWith('|');
      };

      const createParagraphsFromMarkdown = (text: string): (Paragraph | Table)[] => {
        const elements: (Paragraph | Table)[] = [];
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const cleanLine = line.trim();

          if (!cleanLine) {
            elements.push(new Paragraph({ children: [new TextRun({ text: "", font: "Times New Roman" })] }));
            continue;
          }

          if (isTableLine(cleanLine)) {
            const tableLines: string[] = [cleanLine];
            while (i + 1 < lines.length && isTableLine(lines[i + 1].trim())) {
              i++;
              tableLines.push(lines[i].trim());
            }
            if (tableLines.length >= 2) {
              elements.push(createTableFromMarkdown(tableLines));
              elements.push(new Paragraph({ children: [new TextRun({ text: "", font: "Times New Roman" })] }));
            }
            continue;
          }

          const processedLine = processText(cleanLine);

          if (cleanLine.startsWith('### ')) {
            elements.push(new Paragraph({
              children: [new TextRun({ text: processText(cleanLine.replace('### ', '')), bold: true, size: 26, font: "Times New Roman" })],
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 150 }
            }));
            continue;
          }
          if (cleanLine.startsWith('## ')) {
            elements.push(new Paragraph({
              children: [new TextRun({ text: processText(cleanLine.replace('## ', '')), bold: true, size: 28, font: "Times New Roman" })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 }
            }));
            continue;
          }

          const questionMatch = cleanLine.match(/^(\*\*)?(Câu|Bài)\s*\d+[^:]*:/i);
          if (questionMatch) {
            const titleEnd = cleanLine.indexOf(':', questionMatch[0].length - 1) + 1;
            const title = cleanLine.substring(0, titleEnd).replace(/\*\*/g, '');
            const bodyText = cleanLine.substring(titleEnd).trim();
            const children: TextRun[] = [
              new TextRun({ text: title + " ", bold: true, size: 24, font: "Times New Roman" })
            ];
            if (bodyText) {
              children.push(new TextRun({ text: bodyText, size: 24, font: "Times New Roman" }));
            }
            elements.push(new Paragraph({ children, spacing: { before: 300, after: 120 } }));
            continue;
          }

          if (cleanLine.match(/^(\*\*)?(Lời giải|Hướng dẫn giải|Giải|Đáp án đúng)/i)) {
            elements.push(new Paragraph({
              children: [new TextRun({ text: processText(cleanLine), bold: true, size: 24, font: "Times New Roman" })],
              spacing: { before: 200, after: 100 }
            }));
            continue;
          }

          const answerMatch = cleanLine.match(/^([A-D])\.\s+(.*)/);
          if (answerMatch) {
            elements.push(new Paragraph({
              children: [
                new TextRun({ text: answerMatch[1] + ". ", bold: true, size: 24, font: "Times New Roman" }),
                new TextRun({ text: answerMatch[2], size: 24, font: "Times New Roman" })
              ],
              spacing: { after: 80 }
            }));
            continue;
          }

          let displayLine = processedLine;
          let isBullet = false;
          const bulletMatch = displayLine.match(/^[-+*]\s+(.*)$/);
          if (bulletMatch) {
            displayLine = "• " + bulletMatch[1];
            isBullet = true;
          }

          const boldPattern = /\*\*([^*]+)\*\*/g;
          const parts: TextRun[] = [];
          let lastIndex = 0;
          let match;

          while ((match = boldPattern.exec(displayLine)) !== null) {
            if (match.index > lastIndex) {
              parts.push(new TextRun({ text: displayLine.slice(lastIndex, match.index), size: 24, font: "Times New Roman" }));
            }
            parts.push(new TextRun({ text: match[1], bold: true, size: 24, font: "Times New Roman" }));
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex < displayLine.length) {
            parts.push(new TextRun({ text: displayLine.slice(lastIndex).replace(/\*\*/g, ''), size: 24, font: "Times New Roman" }));
          }
          if (parts.length === 0) {
            parts.push(new TextRun({ text: displayLine.replace(/\*\*/g, ''), size: 24, font: "Times New Roman" }));
          }

          elements.push(new Paragraph({
            children: parts,
            spacing: { after: 100 },
            indent: isBullet ? { left: 360 } : undefined
          }));
        }
        return elements;
      };

      const creditParagraph = new Paragraph({
        children: [new TextRun({
          text: "Đề thi được tạo bởi hệ thống - Tác Giả: Lê Thị Thái - THPT Bình Phú - Bình Dương",
          italics: true, size: 22, font: "Times New Roman", color: "666666"
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 }
      });

      const sections: any[] = [];

      // Phần đề bài
      const examParagraphs = createParagraphsFromMarkdown(examContent);
      const sectionChildren: any[] = [
        new Paragraph({
          children: [new TextRun({ text: "ĐỀ THI — TẠO BỞI EDUGENVN", bold: true, size: 32, font: "Times New Roman" })],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        ...examParagraphs,
        creditParagraph,
      ];

      // Nếu có đáp án → thêm page break + đáp án
      if (answersContent) {
        sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
        sectionChildren.push(new Paragraph({
          children: [new TextRun({ text: "ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT", bold: true, size: 32, font: "Times New Roman" })],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 }
        }));
        sectionChildren.push(...createParagraphsFromMarkdown(answersContent));
        sectionChildren.push(creditParagraph);
      }

      const doc = new Document({
        sections: [{ properties: {}, children: sectionChildren }],
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `De_Thi_EduGenVN_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating Word document:", error);
      alert("Có lỗi khi tạo file Word. Vui lòng thử lại.");
    } finally {
      setIsDownloading(false);
    }
  };

  // ============================================
  // DOWNLOAD PPTX
  // ============================================
  const handleDownloadPptx = async () => {
    setIsDownloading(true);
    try {
      const { exportExamToPptx } = await import('../services/pptxExportService');
      await exportExamToPptx({
        id: `mock-${Date.now()}`,
        title: "Đề kiểm tra EduGenVN",
        examContent: examContent,
        answersContent: answersContent,
        examMode: "totnghiep" as any,
        examFormat: "tracnghiem" as any,
        difficulty: "Tổng hợp",
        model: "gemini-2.5-flash",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating PPTX document:", error);
      alert("Không thể xuất file PowerPoint lúc này. Vui lòng thử lại!");
    } finally {
      setIsDownloading(false);
    }
  };

  // ============================================
  // DOWNLOAD PDF (via browser print)
  // ============================================
  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Trình duyệt đã chặn popup. Vui lòng cho phép popup để tải PDF.');
      return;
    }

    const content = answersContent
      ? `${examContent}\n\n---\n\n## ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT\n\n${answersContent}`
      : examContent;

    // Convert markdown-like content to simple HTML
    // Step 1: Pre-process tables into HTML blocks (before paragraph splitting)
    const preProcessTables = (text: string): string => {
      const lines = text.split('\n');
      const result: string[] = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i].trim();
        // Detect start of a markdown table
        if (line.startsWith('|') && line.endsWith('|')) {
          const tableRows: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
            const row = lines[i].trim();
            // Skip separator rows (|---|---|)
            if (!row.match(/^\|[-:\s|]+\|$/)) {
              const cells = row.split('|').filter(c => c.trim() !== '');
              const isHeader = tableRows.length === 0;
              const tag = isHeader ? 'th' : 'td';
              const style = `border:1px solid #333;padding:6px 10px;text-align:center;${isHeader ? 'font-weight:bold;background:#f0f0f0;' : ''}`;
              tableRows.push('<tr>' + cells.map(c => `<${tag} style="${style}">${c.trim()}</${tag}>`).join('') + '</tr>');
            }
            i++;
          }
          if (tableRows.length > 0) {
            result.push(`<table style="border-collapse:collapse;width:100%;margin:12px 0">${tableRows.join('')}</table>`);
          }
        } else {
          result.push(lines[i]);
          i++;
        }
      }
      return result.join('\n');
    };

    const htmlContent = preProcessTables(content)
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^---$/gm, '<hr style="page-break-before: always; border: none;" />')
      // SVG code blocks: render as actual SVG
      .replace(/```svg\n([\s\S]*?)```/g, (_, svgCode) => `<div style="text-align:center;margin:16px 0">${svgCode}</div>`)
      // Xử lý xuống dòng: đoạn mới (2 newlines) → <p>, đơn newline → <br>
      .split(/\n{2,}/)
      .map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        // Skip blocks already wrapped in HTML tags
        if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<table') || trimmed.startsWith('<div')) return trimmed;
        return '<p style="margin:4px 0">' + trimmed.replace(/\n/g, '<br/>') + '</p>';
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Đề Thi — EduGenVN</title>
        <script>
          MathJax = {
            tex: { inlineMath: [['$','$'],['\\\\(','\\\\)']], displayMath: [['$$','$$'],['\\\\[','\\\\]']], processEscapes: true },
            svg: { fontCache: 'global' }
          };
        </` + `script>
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></` + `script>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.7; color: #000; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 16pt; text-align: center; margin-bottom: 20px; }
          h2 { font-size: 14pt; margin-top: 24px; }
          h3 { font-size: 13pt; margin-top: 16px; }
          strong { font-weight: bold; }
          hr { page-break-before: always; border: none; }
          table { border-collapse: collapse; width: 100%; margin: 12px 0; }
          th, td { border: 1px solid #333; padding: 6px 10px; text-align: center; }
          .footer { text-align: center; color: #666; font-size: 10pt; font-style: italic; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; }
          @media print {
            body { padding: 0; }
            @page { size: A4; margin: 15mm 20mm; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <div class="footer">Tác Giả: Lê Thị Thái - THPT Bình Phú - Bình Dương</div>
        <script>
          // Chờ MathJax render xong rồi mở print dialog
          window.addEventListener('load', function() {
            setTimeout(function() {
              if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise().then(function() {
                  setTimeout(function() { window.print(); }, 500);
                });
              } else {
                setTimeout(function() { window.print(); }, 1500);
              }
            }, 1000);
          });
        </` + `script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================
  // SVG RENDERING — Pre-process + Component
  // ============================================

  // Extract SVG from ```svg code blocks → raw SVG so rehype-raw can render them
  const preprocessSvgContent = (content: string): string => {
    if (!content) return content;
    let processed = content;

    // Pattern 1: ```svg ... ``` code blocks → extract raw SVG
    processed = processed.replace(/```svg\s*\n([\s\S]*?)```/g, (_, svgCode) => {
      return `\n\n<div class="svg-diagram">${svgCode.trim()}</div>\n\n`;
    });

    // Pattern 2: Ensure raw <svg> tags are wrapped for styling
    // Only wrap if not already inside a <div class="svg-diagram">
    processed = processed.replace(/(?<!<div[^>]*>\s*)(<svg[\s\S]*?<\/svg>)/gi, (match) => {
      return `\n\n<div class="svg-diagram">${match.trim()}</div>\n\n`;
    });

    return processed;
  };

  // Helper: lấy SVG string từ div.svg-diagram bằng cách render children thành string
  const extractSvgFromDiagramDiv = (el: HTMLElement): string => {
    const svgEl = el.querySelector('svg');
    if (svgEl) return svgEl.outerHTML;
    return '';
  };

  // Helper: lấy context xung quanh SVG (200 ký tự trước và sau)
  const getSvgContext = (svgString: string): string => {
    const idx = examContent.indexOf('<svg');
    if (idx === -1) return examContent.substring(0, 500);
    const start = Math.max(0, idx - 300);
    const end = Math.min(examContent.length, idx + svgString.length + 300);
    return examContent.substring(start, end);
  };

  // Handle SVG regeneration
  const handleRegenerateSvg = async (svgString: string) => {
    if (!onRegenerateSvg) return;
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const context = getSvgContext(svgString);
      await onRegenerateSvg(svgString, context, editPrompt);
      setEditingSvg(null);
      setEditPrompt('');
    } catch (err: any) {
      setRegenError(err.message || 'Không thể tạo lại hình. Thử lại.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Custom components for ReactMarkdown
  const markdownComponents = {
    // Style SVG wrapper divs
    div({ className, children, ...props }: any) {
      if (className === 'svg-diagram') {
        return (
          <div
            className="my-4 flex justify-center"
            style={{ maxWidth: '100%', position: 'relative' }}
          >
            <div
              style={{
                maxWidth: '450px',
                width: '100%',
                overflow: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                padding: '16px',
                background: '#fafbfc',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                position: 'relative',
              }}
            >
              {children}
              {/* Nút Sửa hình + Tải hình */}
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 5, display: 'flex', gap: '4px' }}>
                {/* Tải hình */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const container = (e.currentTarget as HTMLElement).closest('[style*="border-radius"]')?.parentElement;
                    const wrapperDiv = (e.currentTarget as HTMLElement).parentElement?.parentElement;
                    if (!wrapperDiv) return;
                    const svgEl = wrapperDiv.querySelector('svg');
                    if (!svgEl) return;

                    // Clone SVG and set explicit size for rendering
                    const svgClone = svgEl.cloneNode(true) as SVGElement;
                    const viewBox = svgClone.getAttribute('viewBox');
                    let w = 800, h = 600;
                    if (viewBox) {
                      const parts = viewBox.split(/\s+/).map(Number);
                      if (parts.length === 4) { w = parts[2] * 2; h = parts[3] * 2; }
                    }
                    svgClone.setAttribute('width', String(w));
                    svgClone.setAttribute('height', String(h));
                    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                    const svgData = new XMLSerializer().serializeToString(svgClone);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);

                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = w;
                      canvas.height = h;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        canvas.toBlob((blob) => {
                          if (blob) {
                            const pngUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = pngUrl;
                            a.download = `hinh_ve_${Date.now()}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(pngUrl);
                          }
                        }, 'image/png');
                      }
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-white/90 hover:bg-sky-50 border border-sky-300 text-sky-700 rounded-lg text-[11px] font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 backdrop-blur-sm"
                  title="Tải hình xuống (PNG)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Tải
                </button>
                {/* Sửa hình */}
                {onRegenerateSvg && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const wrapperDiv = (e.currentTarget as HTMLElement).parentElement?.parentElement;
                      if (wrapperDiv) {
                        const svg = extractSvgFromDiagramDiv(wrapperDiv);
                        if (svg) {
                          setEditingSvg(svg);
                          setEditPrompt('');
                          setRegenError(null);
                        }
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-white/90 hover:bg-amber-50 border border-amber-300 text-amber-700 rounded-lg text-[11px] font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 backdrop-blur-sm"
                    title="AI tạo lại hình vẽ"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                    Sửa hình
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }
      return <div className={className} {...props}>{children}</div>;
    },
    // Make SVG responsive
    svg(props: any) {
      return (
        <svg
          {...props}
          style={{
            width: '100%',
            height: 'auto',
            maxWidth: '400px',
            display: 'block',
            margin: '0 auto',
            ...(props.style || {}),
          }}
        />
      );
    },
  };

  // Pre-process content for SVG
  const processedExamContent = preprocessSvgContent(examContent);
  const processedAnswersContent = preprocessSvgContent(answersContent);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-md border border-teal-100 overflow-hidden flex flex-col h-[700px] lg:h-[900px]">
      {/* ====== MODAL SỬA HÌNH SVG ====== */}
      {editingSvg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                Sửa hình vẽ bằng AI
              </h3>
              <p className="text-sm text-amber-100 mt-1">AI sẽ vẽ lại hình dựa trên yêu cầu của bạn</p>
            </div>
            <div className="p-5">
              {/* Preview hình cũ */}
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 overflow-auto" style={{ maxHeight: '200px' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hình hiện tại</p>
                <div dangerouslySetInnerHTML={{ __html: editingSvg }} style={{ maxWidth: '300px', margin: '0 auto' }} />
              </div>

              {/* Gợi ý chỉnh sửa nhanh */}
              <div className="mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">💡 Gợi ý nhanh</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { icon: '🏷️', text: 'Thêm nhãn đỉnh/cạnh' },
                    { icon: '📏', text: 'Thêm số đo/kích thước' },
                    { icon: '⭕', text: 'Vẽ đường tròn ngoại tiếp' },
                    { icon: '📐', text: 'Sửa lại tỷ lệ hình' },
                    { icon: '🎨', text: 'Tô màu/highlight cạnh' },
                    { icon: '✏️', text: 'Vẽ lại cho đẹp hơn' },
                    { icon: '📝', text: 'Thêm đường phụ/nét đứt' },
                    { icon: '🔄', text: 'Xoay/lật hình' },
                    { icon: '➕', text: 'Thêm hệ trục tọa độ' },
                    { icon: '📊', text: 'Thêm đồ thị hàm số' },
                  ].map((chip) => {
                    const isSelected = editPrompt.includes(chip.text);
                    return (
                      <button
                        key={chip.text}
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => {
                          if (isSelected) {
                            // Bỏ chọn → xóa chip khỏi prompt
                            setEditPrompt((prev) =>
                              prev.replace(chip.text, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim()
                            );
                          } else {
                            // Chọn thêm → nối vào prompt
                            setEditPrompt((prev) => (prev.trim() ? `${prev.trim()}, ${chip.text}` : chip.text));
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150 disabled:opacity-40 ${
                          isSelected
                            ? 'bg-amber-100 border-amber-400 text-amber-800 shadow-sm ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
                        }`}
                      >
                        <span className="text-[12px]">{chip.icon}</span>
                        {chip.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input yêu cầu sửa */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Yêu cầu sửa <span className="text-slate-400 font-normal">(tùy chọn)</span>
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="VD: Thêm nhãn đỉnh D, vẽ lại đường tròn ngoại tiếp, sửa lại tỷ lệ hình..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none placeholder:text-slate-400"
                  rows={3}
                  disabled={isRegenerating}
                />
                <p className="text-[10px] text-slate-400 mt-1">Để trống nếu chỉ muốn AI vẽ lại cho đẹp hơn</p>
              </div>

              {/* Error */}
              {regenError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  ⚠️ {regenError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingSvg(null); setEditPrompt(''); setRegenError(null); }}
                  disabled={isRegenerating}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium text-sm transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleRegenerateSvg(editingSvg)}
                  disabled={isRegenerating}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg ${
                    isRegenerating
                      ? 'bg-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30 hover:-translate-y-0.5'
                  }`}
                >
                  {isRegenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang vẽ lại...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                      AI Vẽ Lại
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header toolbar */}
      <div className="bg-teal-50 border-b border-teal-100 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 gap-2">
        <h3 className="font-bold text-teal-800 flex items-center gap-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          Nội Dung Đề Thi
        </h3>
        <div className="flex items-center gap-2">
          {/* Tải PDF */}
          <button
            onClick={handleDownloadPDF}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Tải PDF
          </button>
          {/* Tải Word */}
          <button
            onClick={handleDownloadWord}
            disabled={isDownloading}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang tạo...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Tải Word
              </>
            )}
          </button>
          {/* Xuất PPTX */}
          <button
            onClick={handleDownloadPptx}
            disabled={isDownloading}
            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Xuất PPTX
              </>
            )}
          </button>
          
          <div className="w-px h-6 bg-teal-200 mx-1"></div>
          
          {/* Học Flashcard */}
          <button
            onClick={() => setActiveGame('flashcard')}
            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="9"></rect><rect x="14" y="7" width="3" height="5"></rect></svg>
            Flashcard
          </button>

          {/* Làm Trắc Nghiệm */}
          <button
            onClick={() => setActiveGame('quiz')}
            className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
            Chơi Quiz
          </button>

          <div className="w-px h-6 bg-teal-200 mx-1"></div>

          {/* Phân tích đề */}
          <button
            onClick={() => setActiveGame('analytics')}
            className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Phân Tích
          </button>

          {/* Phòng Thi Live */}
          <button
            onClick={() => setActiveGame('live-monitor')}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm font-bold flex items-center gap-1.5 ml-2 border border-emerald-500"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
            </span>
            Phòng Thi Live
          </button>

        </div>
      </div>

      {/* 2 columns: Đề bài | Đáp án */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden bg-white">

        {/* Column 1: ĐỀ BÀI */}
        <div className="flex-1 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-slate-200 p-6 min-h-[50%] lg:min-h-full">
          <div className="sticky top-0 bg-white/95 backdrop-blur z-10 pb-2 mb-4 border-b border-teal-100">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Đề Bài</span>
          </div>
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-teal-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700 prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {processedExamContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Column 2: ĐÁP ÁN */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-teal-50/30 min-h-[50%] lg:min-h-full">
          <div className="sticky top-0 bg-white/95 backdrop-blur z-10 pb-2 mb-4 border-b border-teal-100">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đáp Án & Lời Giải</span>
          </div>

          {answersContent ? (
            /* ĐÃ CÓ ĐÁP ÁN → Hiển thị */
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-teal-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700 prose-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                {processedAnswersContent}
              </ReactMarkdown>
            </div>
          ) : (
            /* CHƯA CÓ ĐÁP ÁN → Hiển thị nút "Tạo đáp án" */
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
              <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-300 p-8 max-w-sm w-full">
                <div className="text-4xl mb-3">📝</div>
                <h4 className="font-bold text-slate-800 text-sm mb-2">Đề bài đã sẵn sàng!</h4>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  Bấm nút bên dưới để AI tạo đáp án & lời giải chi tiết.<br />
                  <span className="text-amber-600 font-medium">(Tách riêng để tránh bị giới hạn API)</span>
                </p>
                <button
                  onClick={onGenerateAnswers}
                  disabled={isGeneratingAnswers}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-white font-bold text-sm transition-all duration-200 shadow-lg ${
                    isGeneratingAnswers
                      ? 'bg-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {isGeneratingAnswers ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang tạo đáp án...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 4V2"></path><path d="M15 16v-2"></path><path d="M8 9h2"></path><path d="M20 9h2"></path>
                        <path d="M17.8 11.8 19 13"></path><path d="M15 9h.01"></path><path d="M17.8 6.2 19 5"></path>
                        <path d="m3 21 9-9"></path><path d="M12.2 6.2 11 5"></path>
                      </svg>
                      Tạo Đáp Án & Lời Giải
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GAMES OVERLAY */}
      {activeGame && (
        <>
          {activeGame === 'flashcard' && (
            <FlashcardGame 
              questions={(() => {
                const qList = parseExamContent(examContent);
                const aMap = parseAnswersContent(answersContent);
                qList.forEach(q => { if (aMap[q.number]) q.answerText += '\n' + aMap[q.number]; });
                return qList;
              })()} 
              onClose={() => setActiveGame(null)} 
            />
          )}

          {activeGame === 'quiz' && (
            <QuizGame 
              questions={(() => {
                const qList = parseExamContent(examContent);
                const aMap = parseAnswersContent(answersContent);
                qList.forEach(q => { if (aMap[q.number]) q.answerText += '\n' + aMap[q.number]; });
                return qList;
              })()} 
              onClose={() => setActiveGame(null)} 
            />
          )}

          {activeGame === 'analytics' && (
            <ExamAnalytics 
              questions={(() => {
                const qList = parseExamContent(examContent);
                const aMap = parseAnswersContent(answersContent);
                qList.forEach(q => { if (aMap[q.number]) q.answerText += '\n' + aMap[q.number]; });
                return qList;
              })()} 
              onClose={() => setActiveGame(null)} 
            />
          )}

          {activeGame === 'live-monitor' && (
            <LiveMonitor 
              questions={(() => {
                const qList = parseExamContent(examContent);
                const aMap = parseAnswersContent(answersContent);
                qList.forEach(q => { if (aMap[q.number]) q.answerText += '\n' + aMap[q.number]; });
                return qList;
              })()} 
              onClose={() => setActiveGame(null)} 
            />
          )}
        </>
      )}

    </div>
  );
};
