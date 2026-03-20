const express = require('express');
const cors = require('cors');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const app = express();

app.use(cors());
// Servimos la carpeta public donde está tu index.html
app.use(express.static(path.join(__dirname, 'public')));

// Cambié /download a /api/download para que coincida con tu HTML
app.get('/api/download', async (req, res) => {
    let videoURL = req.query.url;
    if (!videoURL) return res.status(400).send('Falta la URL');

    // Limpiar links de listas de reproducción
    if (videoURL.includes('&list=')) {
        videoURL = videoURL.split('&list=')[0];
    }

    try {
        console.log(`>>> Procesando para el grupo: ${videoURL}`);

        // 1. Obtener metadatos (Título real)
        const info = await youtubedl(videoURL, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        // Limpiar el título de caracteres raros que rompen Windows/Android
        const cleanTitle = info.title.replace(/[\\\/:*?"<>|]/g, "").substring(0, 50);
        
        // 2. Configurar las cabeceras para que el navegador inicie la descarga
        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `attachment; filename="${cleanTitle}.mp3"`);

        // 3. Ejecutar la extracción de audio en streaming
        const subprocess = youtubedl.exec(videoURL, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: '-', // Esto envía los datos directamente al navegador
            noCheckCertificates: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        // Tubería de datos: del proceso de descarga directo al navegador del amigo
        subprocess.stdout.pipe(res);

        // Manejo de cierre de conexión
        subprocess.on('close', (code) => {
            if (code === 0) console.log(`✅ "${cleanTitle}" enviada con éxito.`);
        });

        // Si el usuario cierra la pestaña o cancela, matamos el proceso para no gastar RAM
        req.on('close', () => {
            if (!subprocess.killed) subprocess.kill();
        });

    } catch (err) {
        console.error('Error detallado:', err);
        // Si hay error, enviamos un mensaje claro pero sin tumbar el server
        if (!res.headersSent) {
            res.status(500).send('Error en el motor: El link podría estar protegido o caído.');
        }
    }
});

// Usamos process.env.PORT para que funcione en Render/Railway automáticamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MPP2: Motor listo en puerto ${PORT}`));