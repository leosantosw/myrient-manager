const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function fetchFilesList(url) {
  try {
    console.log('Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return parseHTML(html, url);
  } catch (error) {
    console.error('Erro ao fazer fetch:', error);
    throw error;
  }
}

function parseHTML(html, baseUrl) {
  const $ = cheerio.load(html);
  const files = [];

  $('tr').each((index, element) => {
    const $row = $(element);

    const $link = $row.find('td.link a');
    if ($link.length === 0) return; 

    const href = $link.attr('href');
    const name = $link.attr('title') || $link.text().trim();

    if (!href || href === '../' || name === '..' || name === '.' || href === './') return;

    const size = $row.find('td.size').text().trim();
    const date = $row.find('td.date').text().trim();

    if (!size || size === '-') return;

    const fullUrl = new URL(href, baseUrl).href;

    files.push({
      name,
      url: fullUrl,
      size,
      date
    });
  });

  console.log(`Parsed ${files.length} files`);
  return files;
}

module.exports = {
  fetchFilesList
};
