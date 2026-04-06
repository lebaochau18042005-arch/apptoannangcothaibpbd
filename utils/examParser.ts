/**
 * Trích xuất các câu hỏi từ nội dung đề thi dạng Markdown text.
 */
export function parseExamContent(content: string) {
  const lines = content.split('\n');
  const questions: { number: number; text: string; options: string[]; answerText: string }[] = [];
  
  let currentQ: any = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Phát hiện bắt đầu câu mới
    const qMatch = line.match(/^(?:Câu|Bài)\s*(\d+)\s*[:.]\s*(.*)/i);
    const formatQMatch = line.match(/^\*\*\*?\s*(?:Câu|Bài)\s*(\d+)\s*[:.]\s*(.*)/i);

    const match = qMatch || formatQMatch;

    if (match) {
      if (currentQ) {
         questions.push(currentQ);
      }
      currentQ = {
        number: parseInt(match[1]),
        text: match[2],
        options: [],
        answerText: ""
      };
    } else if (currentQ) {
      // Phát hiện tùy chọn (A., B., C., D.)
      const optMatch = line.match(/^([A-D])[.):)]\s*(.*)/i);
      
      if (optMatch) {
         currentQ.options.push(line);
      } else {
         if (currentQ.options.length === 0) {
             currentQ.text += '\n' + line;
         } else {
             const ansMatch = line.match(/^(?:Đáp\s*án|Giải|Hướng\s*dẫn)\s*[:.]?\s*(.*)/i);
             if (ansMatch) {
                 currentQ.answerText += line + '\n';
             } else {
                 currentQ.answerText += line + '\n';
             }
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
        
        const match = line.match(/^(?:Câu|Bài)\s*(\d+)\s*[:.]\s*(.*)/i);
        const formatMatch = line.match(/^\*\*\*?\s*(?:Câu|Bài)\s*(\d+)\s*[:.]\s*(.*)/i);
        const m = match || formatMatch;

        if (m) {
            currentNum = parseInt(m[1]);
            answersMap[currentNum] = m[2] + '\n';
        } else if (currentNum !== -1) {
            answersMap[currentNum] += line + '\n';
        }
    }
    return answersMap;
}
