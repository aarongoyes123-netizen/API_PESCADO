import cloudinary from '../config.js';

export const subirImagen = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                mensaje: 'No se envió ninguna imagen'
            });
        }

        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: 'API_PESCADO'
        });

        res.status(200).json({
            mensaje: 'Imagen subida correctamente',
            url: resultado.secure_url,
            public_id: resultado.public_id
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};