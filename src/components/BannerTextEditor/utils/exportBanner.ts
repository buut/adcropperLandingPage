import { TextElement } from '../types';

export const exportBanner = (texts: TextElement[]) => {
  // 1. Export JSON Data
  const jsonData = JSON.stringify(texts, null, 2);
  const jsonBlob = new Blob([jsonData], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = 'banner_data.json';
  document.body.appendChild(jsonLink);
  jsonLink.click();
  document.body.removeChild(jsonLink);

  // 2. Export HTML Preview
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banner Preview</title>
  <!-- Load Google Fonts dynamically if needed, normally we'd parse the used fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f0f0f0;
    }
    .banner-container {
      position: relative;
      width: 300px;
      height: 250px;
      background-color: #ffffff;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .text-element {
      position: absolute;
      transform-origin: center;
      word-wrap: break-word;
      white-space: pre-wrap;
      line-height: normal;
    }
  </style>
</head>
<body>
  <div class="banner-container">
    ${texts
      .filter(t => t.visible)
      // Sort by z-index equivalent (array order)
      .map((t, index) => {
        return `
        <div class="text-element" style="
          transform: translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg);
          width: ${t.width !== 'auto' as any ? t.width + 'px' : 'auto'};
          height: ${t.height !== 'auto' as any ? t.height + 'px' : 'auto'};
          font-family: '${t.fontFamily}', sans-serif;
          font-size: ${t.fontSize}px;
          font-weight: ${t.fontWeight};
          font-style: ${t.fontStyle};
          text-decoration: ${t.textDecoration};
          text-align: ${t.textAlign};
          line-height: ${t.lineHeight};
          letter-spacing: ${t.letterSpacing}px;
          color: ${t.color};
          opacity: ${t.opacity};
          z-index: ${index + 1};
        ">
          ${t.text}
        </div>
        `;
      }).join('')}
  </div>
</body>
</html>
  `;
  
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  const htmlUrl = URL.createObjectURL(htmlBlob);
  const htmlLink = document.createElement('a');
  htmlLink.href = htmlUrl;
  htmlLink.download = 'banner_preview.html';
  document.body.appendChild(htmlLink);
  htmlLink.click();
  document.body.removeChild(htmlLink);
};
