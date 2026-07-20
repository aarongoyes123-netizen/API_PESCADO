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

    if (!req.file) {
        return res.status(400).json({
            mensaje: "No hay imagen"
        });
    }


    // responder inmediatamente
    res.status(200).json({
        mensaje: "Imagen recibida",
        estado: "procesando"
    });


    // ejecutar después
    ejecutarModelo(req.file.path)
        .then(resultado => {
            console.log(resultado);
        })
        .catch(err => {
            console.log(err);
        });


};