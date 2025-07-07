export function generateCSV(transcription, timeOffset = 0) {
  let csvContent = 'start,end,subtitles\n';
  
  if (transcription.segments) {
    transcription.segments.forEach(segment => {
      // 時間オフセットを適用（指定開始時刻を加算）
      const start = formatTime(segment.start + timeOffset);
      const end = formatTime(segment.end + timeOffset);
      const text = segment.text.trim().replace(/"/g, '""');
      csvContent += `${start},${end},"${text}"\n`;
    });
  }
  
  return csvContent;
}

export function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  const segments = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 3) {
      segments.push({
        start: values[0],
        end: values[1],
        text: values[2]
      });
    }
  }
  
  return segments;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

export function parseTime(timeStr) {
  // hh:mm:ss.sss, mm:ss.sss または ss.sss 形式をパース
  const timeParts = timeStr.split(':');
  
  if (timeParts.length === 3) {
    // hh:mm:ss.sss 形式
    const hours = parseInt(timeParts[0], 10) || 0;
    const mins = parseInt(timeParts[1], 10) || 0;
    const secParts = timeParts[2].split('.');
    const secs = parseInt(secParts[0], 10) || 0;
    const ms = secParts[1] ? parseInt(secParts[1], 10) : 0;
    return hours * 3600 + mins * 60 + secs + ms / 1000;
  } else if (timeParts.length === 2) {
    // mm:ss.sss 形式
    const mins = parseInt(timeParts[0], 10) || 0;
    const secParts = timeParts[1].split('.');
    const secs = parseInt(secParts[0], 10) || 0;
    const ms = secParts[1] ? parseInt(secParts[1], 10) : 0;
    return mins * 60 + secs + ms / 1000;
  } else {
    // ss.sss 形式
    return parseFloat(timeStr) || 0;
  }
}