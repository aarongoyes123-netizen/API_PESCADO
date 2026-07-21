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

            console.log("PYTHON:", data.toString());

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

        console.log("1. Entró al controlador");


        if (!req.file) {
            console.log("No llegó archivo");

            return res.status(400).json({
                mensaje: "No hay imagen"
            });
        }


        console.log("2. Imagen:");
        console.log(req.file.path);



        res.status(200).json({
            mensaje: "Imagen recibida",
            estado: "procesando"
        });



        console.log("3. Antes de ejecutar Python");


        const resultadoModelo =
            await ejecutarModelo(req.file.path);



        console.log("4. Resultado:");
        console.log(resultadoModelo);



    } catch (error) {

        console.log("ERROR:");
        console.log(error);

    }

};