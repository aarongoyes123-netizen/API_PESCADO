import { Router } from 'express';
import multer from 'multer';
import { subirImagen, obtenerResultado, estadoServidor } from '../Controladores/imagenCtrl.js';

const router = Router();

const upload = multer({
    dest: 'uploads/'
});

router.post('/subir', upload.single('imagen'), subirImagen);
router.get('/resultado/:id', obtenerResultado);
router.get('/estado', estadoServidor);

export default router;
