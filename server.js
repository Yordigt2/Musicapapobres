const express = require('express');
const cors = require('cors');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/download', async (req, res) => {
    let videoURL = req.query.url;
    if (!videoURL) return res.status(400).send('Falta la URL');

    if (videoURL.includes('&list=')) {
        videoURL = videoURL.split('&list=')[0];
    }

    try {
        console.log(`>>> Solicitud para: ${videoURL}`);

        // 1. Obtener metadatos con User-Agent Real
        const info = await youtubedl(videoURL, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            ]
        });

        const cleanTitle = info.title.replace(/[\\\/:*?"<>|]/g, "").substring(0, 50);
        
        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `attachment; filename="${cleanTitle}.mp3"`);

        // 2. Extracción de audio con streaming directo
        const subprocess = youtubedl.exec(videoURL, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: '-', 
            noCheckCertificates: true,
            // Banderas extra para evitar bloqueos en la nube
            geoBypass: true,
            addHeader: [
                'referer:https://www.youtube.com/',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            ]
        });

        // Tubería: YouTube -> Render -> Amigos
        subprocess.stdout.pipe(res);

        subprocess.on('close', (code) => {
            if (code === 0) console.log(`✅ "${cleanTitle}" enviada.`);
        });

        // Matar proceso si el usuario cancela para no saturar Render
        req.on('close', () => {
            if (!subprocess.killed) subprocess.kill();
        });

    } catch (err) {
        console.error('Error en el motor:', err);
        if (!res.headersSent) {
            res.status(500).send('Error en el motor: YouTube bloqueó la conexión. Intenta con otro link.');
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MPP2: Motor de alta fidelidad activo en puerto ${PORT}`));