import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FlashcardQuestion } from './games/FlashcardGame';

interface ExamAnalyticsProps {
  questions: FlashcardQuestion[];
  onClose: () => void;
}

export const ExamAnalytics: React.FC<ExamAnalyticsProps> = ({ questions, onClose }) => {
  const pieChartRef = useRef<SVGSVGElement>(null);
  const barChartRef = useRef<SVGSVGElement>(null);
  const [stats, setStats] = useState<{A: number, B: number, C: number, D: number, totalOpts: number, maxWords: number}>({ 
      A: 0, B: 0, C: 0, D: 0, totalOpts: 0, maxWords: 0 
  });

  useEffect(() => {
    if (!questions || questions.length === 0) return;

    // 1. Phân tích Dữ liệu Đáp án (A, B, C, D)
    const optionsCount = { A: 0, B: 0, C: 0, D: 0 };
    const charCounts: { qIdx: number, qCharCount: number, qText: string }[] = [];

    questions.forEach((q, i) => {
        // Estimate Option
        let foundLetter = null;
        if (q.options.length > 0) {
            const answerMatch = q.answerText.match(/(?:Đáp\s*án|Chọn|=>|▶)\s*[:.\-]?\s*([A-D])/i);
            if (answerMatch) foundLetter = answerMatch[1].toUpperCase();
            else {
                const bkMatch = q.answerText.match(/\b([A-D])\b/i);
                if (bkMatch) foundLetter = bkMatch[1].toUpperCase();
            }
        }
        if (foundLetter && foundLetter in optionsCount) {
            optionsCount[foundLetter as keyof typeof optionsCount]++;
        }

        // Đếm độ dài (Dựa theo số chữ trong câu hỏi, ước lượng độ phức tạp/khó)
        charCounts.push({
            qIdx: i + 1,
            qCharCount: q.text.replace(/\s+/g, ' ').split(' ').length,
            qText: q.text
        });
    });

    const totalOpts = optionsCount.A + optionsCount.B + optionsCount.C + optionsCount.D;
    const maxWords = Math.max(...charCounts.map(c => c.qCharCount), 10);
    setStats({ ...optionsCount, totalOpts, maxWords });

    // ==========================================
    // VẼ BIỂU ĐỒ DONUT (Pie Chart) - D3
    // ==========================================
    if (pieChartRef.current && totalOpts > 0) {
        const svg = d3.select(pieChartRef.current);
        svg.selectAll('*').remove();

        const width = 300;
        const height = 300;
        const margin = 20;
        const radius = Math.min(width, height) / 2 - margin;

        const pieSvg = svg
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        const dataObj: any = optionsCount;
        const color = d3.scaleOrdinal()
          .domain(["A", "B", "C", "D"])
          .range(["#6366f1", "#14b8a6", "#f59e0b", "#ec4899"]);

        const pie = d3.pie<{key: string, value: number}>()
            .value(d => d.value)
            .sort(null);

        const data_ready = pie(Object.entries(dataObj).map(([k, v]) => ({ key: k, value: v as number })));

        const arc = d3.arc<any>()
            .innerRadius(radius * 0.5)         // Donut
            .outerRadius(radius);

        const arcHover = d3.arc<any>()
            .innerRadius(radius * 0.5)
            .outerRadius(radius + 10);

        // Add Tooltip Div
        const tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(15, 23, 42, 0.9)')
            .style('color', '#fff')
            .style('padding', '6px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 9999);

        // Render Slices
        pieSvg.selectAll('path')
            .data(data_ready)
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.key) as string)
            .attr("stroke", "white")
            .style("stroke-width", "2px")
            .style("opacity", 0.9)
            .on("mouseover", function(event, d) {
                d3.select(this)
                  .transition().duration(200)
                  .attr("d", arcHover)
                  .style("opacity", 1);
                
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`<strong>Đáp án ${d.data.key}</strong><br/>Số lượng: ${d.data.value}`);
            })
            .on("mousemove", function(event) {
                tooltip
                  .style("left", (event.pageX + 15) + "px")
                  .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                  .transition().duration(200)
                  .attr("d", arc)
                  .style("opacity", 0.9);
                tooltip.transition().duration(200).style('opacity', 0);
            });

        // Add labels
        pieSvg.selectAll('text')
            .data(data_ready)
            .enter()
            .append('text')
            .text(d => d.data.value > 0 ? d.data.key : '')
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .style("text-anchor", "middle")
            .style("font-size", 14)
            .style("font-weight", 700)
            .style("fill", "#fff")
            .style("pointer-events", "none");

        // Clean up tooltip
        return () => {
            d3.selectAll('.d3-tooltip').remove();
        }
    }

    // ==========================================
    // VẼ BIỂU ĐỒ BAR (Bar Chart) - Độ Khó
    // ==========================================
    if (barChartRef.current && charCounts.length > 0) {
        const svg = d3.select(barChartRef.current);
        svg.selectAll('*').remove();

        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 20, bottom: 40, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const mainSvg = svg
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X scale (Câu hỏi)
        const x = d3.scaleBand()
            .domain(charCounts.map(d => `Câu ${d.qIdx}`))
            .range([0, innerWidth])
            .padding(0.2);

        mainSvg.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("fill", "#64748b")
            .style("font-size", "11px")
            // Hide some labels if there are too many (e.g. >20)
            .style("display", (_, i) => charCounts.length > 20 && i % 2 !== 0 ? "none" : "block");

        // Y scale (Độ dài số từ)
        const y = d3.scaleLinear()
            .domain([0, maxWords * 1.1])
            .range([innerHeight, 0]);

        mainSvg.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .selectAll("text")
            .style("fill", "#64748b");

        // Grid lines
        mainSvg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ""))
            .selectAll("line")
            .attr("stroke", "#f1f5f9")
            .attr("stroke-dasharray", "3,3");

        // D3 Tooltip cho barchart
        const tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tooltip-bar')
            .style('position', 'absolute')
            .style('background', 'rgba(15, 23, 42, 0.9)')
            .style('color', '#fff')
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('max-width', '250px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 9999);

        // Threshold line (Average)
        const avgCharCount = charCounts.reduce((sum, c) => sum + c.qCharCount, 0) / charCounts.length;
        mainSvg.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", y(avgCharCount))
            .attr("y2", y(avgCharCount))
            .attr("stroke", "#f43f5e")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4")
            .style("opacity", 0.7);

        // Bars
        mainSvg.selectAll("rect.bar")
            .data(charCounts)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(`Câu ${d.qIdx}`)!)
            .attr("y", innerHeight)
            .attr("width", x.bandwidth())
            .attr("height", 0) // Start from bottom for animation
            .attr("fill", d => d.qCharCount > avgCharCount ? "#3b82f6" : "#0ea5e9") // Higher = darker
            .attr("rx", 4)
            .on("mouseover", function(event, d) {
                d3.select(this)
                  .transition().duration(150)
                  .attr("fill", "#6366f1");
                
                tooltip.transition().duration(200).style('opacity', 1);
                // Truncate text for tooltip
                const textPreview = d.qText.length > 50 ? d.qText.substring(0, 50) + "..." : d.qText;
                tooltip.html(`<strong>Câu ${d.qIdx}</strong><br/>Độ dài chữ: ${d.qCharCount}<br/><span style="color:#94a3b8; font-size:10px">${textPreview}</span>`);
            })
            .on("mousemove", function(event) {
                tooltip
                  .style("left", (event.pageX + 15) + "px")
                  .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                  .transition().duration(300)
                  .attr("fill", d.qCharCount > avgCharCount ? "#3b82f6" : "#0ea5e9");
                tooltip.transition().duration(200).style('opacity', 0);
            })
            // Animation
            .transition()
            .duration(800)
            .delay((_, i) => i * 30) // Stagger
            .attr("y", d => y(d.qCharCount))
            .attr("height", d => innerHeight - y(d.qCharCount));

        // Clean up
        return () => {
            d3.selectAll('.d3-tooltip-bar').remove();
        }
    }
  }, [questions]);

  // UI Stats View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm sm:p-8 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-slate-50 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
               <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">D3 Dashboard Phân Tích Đề Thi</h2>
                <p className="text-sm font-medium text-slate-500">Thống kê tự động ứng dụng cấu trúc D3.js</p>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors flex shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Dash contents */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
           
           {/* Top Stats Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng Số Câu</div>
                 <div className="text-3xl font-black text-slate-700">{questions.length}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mức Độ Chữ Cao Nhất</div>
                 <div className="text-3xl font-black text-blue-600">{stats.maxWords}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center col-span-2 md:col-span-2">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tần Suất Đáp Án Tính Được</div>
                 <div className="flex justify-center gap-6 w-full">
                     {["A", "B", "C", "D"].map(opt => (
                         <div key={opt} className="flex flex-col items-center">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold text-sm mb-1 ${
                                opt === 'A' ? 'bg-indigo-500' : opt === 'B' ? 'bg-teal-500' : opt === 'C' ? 'bg-amber-500' : 'bg-pink-500'
                            }`}>{opt}</span>
                            <span className="font-bold text-slate-600">{(stats as any)[opt]}</span>
                         </div>
                     ))}
                 </div>
              </div>
           </div>

           {/* Charts Layer */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Pie Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                 <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                   Phân Bố Đáp Án
                 </h3>
                 <div className="flex-1 flex justify-center items-center h-full min-h-[250px]">
                    {stats.totalOpts > 0 ? (
                        <svg ref={pieChartRef} className="w-full h-full max-w-[250px] overflow-visible"></svg>
                    ) : (
                        <div className="text-slate-400 text-sm text-center">Không đủ dữ liệu A/B/C/D từ lời giải (Có thể là đề tự luận)</div>
                    )}
                 </div>
              </div>

              {/* Bar Chart */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                 <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                   Tương Quan Độ Dài (Đánh Giá Độ Phức Tạp)
                 </h3>
                 <div className="flex-1 flex justify-center items-end min-h-[250px] w-full">
                    <svg ref={barChartRef} className="w-full h-full overflow-visible"></svg>
                 </div>
                 <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Trên trung bình</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-500 rounded-sm"></div> Dưới trung bình</div>
                    <div className="flex items-center gap-1.5"><div className="w-6 h-1 border-t-2 border-dashed border-rose-500"></div> Mốc trung bình</div>
                 </div>
              </div>

           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
};
