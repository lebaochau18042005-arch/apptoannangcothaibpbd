/**
 * Trích xuất các câu hỏi từ nội dung đề thi dạng Markdown text.
 */
export function parseExamContent(content: string) {
  const lines = content.split('\n');
  const questions: { number: number; text: string; options: string[]; answerText: string }[] = [];
  
  let currentQ: any = null;
  let qNumber = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Loại bỏ ký tự markdown bold/italic bao ngoài để dễ match hơn
    const stripped = line.replace(/\*+/g, '').replace(/#+\s*/, '').trim();

    // Phát hiện bắt đầu câu mới — hỗ trợ nhiều format AI khác nhau:
    // "Câu 1:", "Câu 1.", "Câu 1 ", "**Câu 1:**", "**1.**", "1.", "## Câu 1", "Bài 1:"
    const patterns = [
      // Format "Câu X:" hoặc "Bài X:" (phổ biến nhất)
      stripped.match(/^(?:Câu|Bài|câu|bài)\s*(\d+)\s*[:.)]?\s*(.*)/i),
      // Format "X." hoặc "X)" — số thứ tự đơn giản
      stripped.match(/^(\d+)[.)]\s+(.+)/),
    ];

    const match = patterns.find(Boolean);

    if (match) {
      if (currentQ) {
         questions.push(currentQ);
      }
      qNumber = parseInt(match[1]);
      currentQ = {
        number: qNumber,
        text: match[2] || '',
        options: [],
        answerText: ""
      };
    } else if (currentQ) {
      // Phát hiện tùy chọn A, B, C, D — hỗ trợ nhiều cách viết
      const optMatch = stripped.match(/^([A-D])\s*[.):\s]\s*(.*)/i);
      
      if (optMatch) {
         currentQ.options.push(stripped);
      } else {
         if (currentQ.options.length === 0) {
             // Vẫn là phần text của câu hỏi
             if (currentQ.text) {
                 currentQ.text += '\n' + line;
             } else {
                 currentQ.text = line;
             }
         } else {
             // Lời giải / đáp án (xuất hiện sau các lựa chọn)
             currentQ.answerText += line + '\n';
         }
      }
    }
  }

  if (currentQ) {
      questions.push(currentQ);
  }

  return questions;
}

/**
 * Trích xuất đáp án từ answersContent
 */
export function parseAnswersContent(content: string) {
    if (!content) return {};
    
    const lines = content.split('\n');
    const answersMap: Record<number, string> = {};
    let currentNum = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const stripped = line.replace(/\*+/g, '').trim();

        // Match nhiều format: "Câu 1:", "**Câu 1:**", "1.", "1)"
        const match = stripped.match(/^(?:Câu|Bài|câu|bài)?\s*(\d+)\s*[:.)]?\s*(.*)/i);
        
        if (match && /^(?:Câu|Bài|câu|bài|\d)/.test(stripped)) {
            currentNum = parseInt(match[1]);
            answersMap[currentNum] = (match[2] || '') + '\n';
        } else if (currentNum !== -1) {
            answersMap[currentNum] += line + '\n';
        }
    }
    return answersMap;
}
