import cloudinary from '../config.js';
import { spawn } from 'child_process';

function ejecutarModelo(rutaImagen) {
    return new Promise((resolve, reject) => {

        const python = spawn('python', [
            'src/Script/Scriptdmodelo.py',   // Cambia por el nombre real de tu script
            rutaImagen
        ]);

        let salida = '';
        let error = '';

        python.stdout.on('data', (data) => {
            salida += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {

            if (code !== 0) {
                return reject(new Error(error));
            }

            try {
                resolve(JSON.parse(salida));
            } catch (e) {
                reject(new Error('La salida del script no es un JSON válido.'));
            }

        });

    });
}

export const subirImagen = async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({
                mensaje: 'No se envió ninguna imagen'
            });
        }

        // Ejecutar el modelo de IA
        const resultadoModelo = await ejecutarModelo(req.file.path);

        // Subir la imagen a Cloudinary
        const resultadoCloudinary = await cloudinary.uploader.upload(
            req.file.path,
            {
                folder: 'API_PESCADO'
            }
        );

        // Respuesta
        res.status(200).json({

            mensaje: 'Imagen subida correctamente',

            url: resultadoCloudinary.secure_url,

            public_id: resultadoCloudinary.public_id,

            analisis: resultadoModelo

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: error.message
        });

    }

};