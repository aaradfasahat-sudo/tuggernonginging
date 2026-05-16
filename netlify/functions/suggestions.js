const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const q = ((event.queryStringParameters || {}).q || '').trim();
  if (!q) {
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: '[]' };
  }

  try {
    const r = await fetch(
      'https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list',
      {
        headers: {
          'User-Agent': pickUA(),
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!r.ok) return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: '[]' };

    const data = await r.json();
    let suggestions = [];
    if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
      suggestions = data[1];
    } else if (Array.isArray(data)) {
      suggestions = data.map(d => (typeof d === 'string' ? d : d.phrase)).filter(Boolean);
    }
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(suggestions.slice(0, 8)),
    };
  } catch (e) {
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: '[]' };
  }
};
