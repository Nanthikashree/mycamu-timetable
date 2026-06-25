const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const API_KEY = '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';

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/upload-pdf') {
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                const result = await mammoth.extractRawText({ buffer });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text: result.value }));
            } catch(e) {
                console.log('DOCX Error:', e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/generate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { prompt } = JSON.parse(body);

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
                    'Authorization': `Bearer ${API_KEY}`
                }
            };

            const apiReq = https.request(options, apiRes => {
                let data = '';
                apiRes.on('data', chunk => data += chunk);
                apiRes.on('end', () => {
                    console.log('API Response:', data);
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.choices[0].message.content;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result: text }));
                    } catch(e) {
                        console.log('Parse error:', e.message);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
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

server.listen(3000, () => console.log('Server running at http://localhost:3000'));