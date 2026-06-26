const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/generate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { prompt } = JSON.parse(body);

            const payload = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            });

            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const apiReq = https.request(options, apiRes => {
                let data = '';
                apiRes.on('data', chunk => data += chunk);
                apiRes.on('end', () => {
                    console.log('API Response:', data.substring(0, 200));
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            console.log('Gemini error, trying Groq...');
                            tryGroq(prompt, res);
                            return;
                        }
                        const text = parsed.candidates[0].content.parts[0].text;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result: text }));
                    } catch(e) {
                        console.log('Parse error, trying Groq...');
                        tryGroq(prompt, res);
                    }
                });
            });

            apiReq.on('error', () => tryGroq(prompt, res));
            apiReq.write(payload);
            apiReq.end();
        });
        return;
    }

    const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(content);
    });
});

function tryGroq(prompt, res) {
    const payload = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000
    });

    const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
        }
    };

    const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const text = parsed.choices[0].message.content;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ result: text }));
            } catch(e) {
                res.writeHead(500);
                res.end(JSON.stringify({ result: 'Error: ' + data }));
            }
        });
    });

    apiReq.on('error', err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
    });

    apiReq.write(payload);
    apiReq.end();
}

server.listen(process.env.PORT || 8080, '0.0.0.0', () => console.log('Server running!'));