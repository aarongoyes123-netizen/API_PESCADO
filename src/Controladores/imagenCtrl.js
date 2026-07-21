import cloudinary from '../config.js'; // Asegúrate de que este archivo exporta la instancia configurada (v2)
import { spawn } from 'child_process';

// ==========================
// FUNCIÓN PARA EJECUTAR PYTHON
// ==========================
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
                // Buscamos la posición del primer carácter '{'
                const inicioJson = salida.indexOf('{');
                
                if (inicioJson === -1) {
                    throw new Error("No se encontró ningún JSON en la salida de Python.");
                }

                // Extraemos el texto desde la primera llave '{' hasta el final
                const jsonLimpio = salida.substring(inicioJson);
                
                // Parseamos únicamente el JSON limpio
                resolve(JSON.parse(jsonLimpio));

            } catch (e) {
                reject(new Error('La salida del script no es un JSON válido. Detalles: ' + e.message));
            }
        });
    });
}

// ==========================
// CONTROLADOR PRINCIPAL
// ==========================
export const subirImagen = async (req, res) => {

    try {
        console.log("1. Entró al controlador");

        if (!req.file) {
            console.log("No llegó archivo");
            return res.status(400).json({
                success: false,
                mensaje: "No hay imagen"
            });
        }

        const rutaImagenLocal = req.file.path;
        console.log("2. Imagen guardada temporalmente en:", rutaImagenLocal);

        // 3. Subir la imagen a Cloudinary
        console.log("3. Subiendo imagen a Cloudinary...");
        const resultadoCloudinary = await cloudinary.uploader.upload(rutaImagenLocal, {
            folder: 'analisis_imagenes' // Opcional: crea una carpeta en tu Cloudinary
        });
        console.log("-> Imagen subida con éxito:", resultadoCloudinary.secure_url);

        // 4. Ejecutar el script de Python con la imagen local
        console.log("4. Ejecutando modelo Python...");
        const resultadoModelo = await ejecutarModelo(rutaImagenLocal);
        console.log("-> Resultado del modelo obtenido");

        // 5. Enviar la respuesta final al cliente (ESP32)
        // Ahora tu ESP32 imprimirá este JSON completo en el Monitor Serie
        return res.status(200).json({
            success: true,
            mensaje: "Análisis completado",
            imagen_url: resultadoCloudinary.secure_url,
            datos_ia: resultadoModelo
        });

    } catch (error) {
        console.log("ERROR EN CONTROLADOR:");
        console.log(error);

        return res.status(500).json({
            success: false,
            mensaje: "Error interno del servidor",
            error: error.message
        });
    }

};