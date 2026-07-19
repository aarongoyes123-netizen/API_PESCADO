import { Router } from 'express';
import multer from 'multer';
import { subirImagen } from '../Controladores/imagenCtrl.js';

const router = Router();

const upload = multer({
    dest: 'uploads/'
});

router.post('/subir', upload.single('imagen'), subirImagen);

export default router;