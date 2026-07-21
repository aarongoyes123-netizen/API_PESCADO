import cloudinary from '../config.js';
import { spawn } from 'child_process';

function ejecutarModelo(rutaImagen) {
    return new Promise((resolve, reject) => {

        const python = spawn('python', [
            'src/Script/Scriptdmodelo.py',   // Asegúrate de que esta ruta sea correcta
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
                // 💡 SOLUCIÓN: Buscamos la posición del primer carácter '{'
                const inicioJson = salida.indexOf('{');
                
                if (inicioJson === -1) {
                    throw new Error("No se encontró ningún JSON en la salida de Python.");
                }

                // 💡 Extraemos el texto desde la primera llave '{' hasta el final
                const jsonLimpio = salida.substring(inicioJson);
                
                // Parseamos únicamente el JSON limpio
                resolve(JSON.parse(jsonLimpio));

            } catch (e) {
                reject(new Error('La salida del script no es un JSON válido. Detalles: ' + e.message));
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

        // OJO: Al responder aquí al cliente, la conexión HTTP se cierra.
        // El cliente recibirá este mensaje, pero NO recibirá el resultado del modelo.
        // El modelo se ejecutará en segundo plano y verás el resultado en tu consola de Render.
        res.status(200).json({
            mensaje: "Imagen recibida",
            estado: "procesando"
        });

        console.log("3. Antes de ejecutar Python");

        const resultadoModelo = await ejecutarModelo(req.file.path);

        console.log("4. Resultado:");
        console.log(resultadoModelo);

        // ⚠️ Si deseas enviar el resultado del modelo al frontend, debes quitar 
        // el res.status(200) de arriba y usar esto en su lugar:
        // return res.status(200).json(resultadoModelo);

    } catch (error) {

        console.log("ERROR:");
        console.log(error);

        // Es buena práctica devolver un error al cliente si algo falla,
        // siempre y cuando no hayas enviado ya un res.status() arriba.
        // res.status(500).json({ error: error.message });
    }

};