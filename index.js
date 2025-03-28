const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/getIP', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
});

app.post('/submitInstagram', (req, res) => {
    const { instagramId } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const date = new Date().toLocaleString();
    
    const data = `Instagram: ${instagramId} | IP: ${ip} | Date: ${date}\n`;
    
    fs.appendFile('instagram_ids.txt', data, (err) => {
        if (err) {
            console.error('Failed to save Instagram ID:', err);
            res.json({ success: false });
            return;
        }
        console.log('New Instagram ID saved:', instagramId);
        res.json({ success: true });
    });
});

app.get('/admin', (req, res) => {
    const password = req.query.password;
    const authenticated = password === 'admin123'; // Change this password!

    if (authenticated) {
        fs.readFile('instagram_ids.txt', 'utf8', (err, data) => {
            const entries = err ? [] : data.split('\n').filter(line => line.trim());
            res.render('admin', { authenticated, entries });
        });
    } else {
        res.render('admin', { authenticated, entries: [] });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});