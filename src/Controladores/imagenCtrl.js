import cloudinary from '../config.js'; // instancia configurada (v2)
import fs from 'fs/promises';
import crypto from 'crypto';
import { analizarImagen, iniciarModelo, modeloListo } from './modeloWorker.js';

// Cargar los modelos apenas arranca el servidor (no esperar a la primera foto)
iniciarModelo();

// ==========================
// TRABAJOS EN MEMORIA
// ==========================
// id -> { estado: 'procesando' | 'listo' | 'error', ... }
const trabajos = new Map();
const VIDA_TRABAJO_MS = 30 * 60 * 1000; // se borran a los 30 min

setInterval(() => {
    const ahora = Date.now();
    for (const [id, t] of trabajos) {
        if (ahora - t.creado > VIDA_TRABAJO_MS) trabajos.delete(id);
    }
}, 5 * 60 * 1000);

// ==========================
// VEREDICTO FINAL: "el peor de los dos"
// ==========================
// Se clasifican ojo y cuerpo por separado; el resultado final es el PEOR estado
// encontrado (deteriorado > regular > fresco). Asi nunca se reporta "fresco"
// si alguna parte del pescado muestra deterioro.
const GRAVEDAD = { fresco: 0, regular: 1, deteriorado: 2 };

function resumir(datosIA) {
    if (!datosIA || datosIA.success === false) {
        return { clasificacion: 'error', confianza: 0, criterio: null, detalle: [] };
    }
    const lista = (datosIA.resultados || [])
        .filter((r) => r.clasificacion in GRAVEDAD);
    if (lista.length === 0) {
        return { clasificacion: 'sin_pescado', confianza: 0, criterio: null, detalle: [] };
    }

    // Peor estado; si dos partes empatan en el peor estado, gana la de mayor confianza
    const peor = lista.reduce((a, b) => {
        const ga = GRAVEDAD[a.clasificacion], gb = GRAVEDAD[b.clasificacion];
        if (gb !== ga) return gb > ga ? b : a;
        return b.confianza_clasificacion > a.confianza_clasificacion ? b : a;
    });

    return {
        clasificacion: peor.clasificacion,             // fresco | regular | deteriorado
        confianza: peor.confianza_clasificacion,       // % de la parte que decidio
        criterio: peor.objeto_detectado,               // ojo / pescado: que parte decidio
        detalle: lista.map((r) => ({                   // cada parte, para la tesis o una web
            parte: r.objeto_detectado,
            clasificacion: r.clasificacion,
            confianza: r.confianza_clasificacion
        }))
    };
}

// Se ejecuta DESPUES de responder al ESP32
async function procesarEnSegundoPlano(id, rutaImagenLocal) {
    console.log(`[${id}] Procesando en segundo plano...`);
    const [subida, modelo] = await Promise.allSettled([
        cloudinary.uploader.upload(rutaImagenLocal, { folder: 'analisis_imagenes' }),
        analizarImagen(rutaImagenLocal)
    ]);

    const imagen_url = subida.status === 'fulfilled' ? subida.value.secure_url : null;
    if (subida.status === 'rejected') {
        console.log(`[${id}] ERROR Cloudinary:`, subida.reason?.message);
    } else {
        console.log(`[${id}] Imagen en Cloudinary:`, imagen_url);
    }

    if (modelo.status === 'fulfilled') {
        const resumen = resumir(modelo.value);
        trabajos.set(id, {
            estado: 'listo',
            creado: trabajos.get(id)?.creado ?? Date.now(),
            ...resumen,
            imagen_url,
            datos_ia: modelo.value
        });
        console.log(`[${id}] Resultado:`, resumen);
    } else {
        trabajos.set(id, {
            estado: 'error',
            creado: trabajos.get(id)?.creado ?? Date.now(),
            mensaje: modelo.reason?.message,
            imagen_url
        });
        console.log(`[${id}] ERROR modelo:`, modelo.reason?.message);
    }

    fs.unlink(rutaImagenLocal).catch(() => {});
}

// ==========================
// POST /imagen/subir
// Responde de inmediato con un id; el analisis sigue en segundo plano.
// ==========================
export const subirImagen = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, mensaje: 'No hay imagen' });
    }

    const id = crypto.randomUUID().slice(0, 8);
    trabajos.set(id, { estado: 'procesando', creado: Date.now() });
    console.log(`[${id}] Imagen recibida: ${req.file.path} (${req.file.size} bytes)`);

    res.status(202).json({ success: true, mensaje: 'Imagen recibida', id });

    procesarEnSegundoPlano(id, req.file.path).catch((e) => {
        console.log(`[${id}] ERROR inesperado:`, e);
        trabajos.set(id, { estado: 'error', creado: Date.now(), mensaje: e.message });
    });
};

// ==========================
// GET /imagen/resultado/:id
// ==========================
export const obtenerResultado = (req, res) => {
    const t = trabajos.get(req.params.id);
    if (!t) {
        return res.status(404).json({ success: false, estado: 'no_encontrado' });
    }
    // estado y clasificacion van primero para que el ESP32 los lea facil
    return res.json({ success: true, ...t });
};

// ==========================
// GET /imagen/estado  (para despertar Render y saber si el modelo cargo)
// ==========================
export const estadoServidor = (req, res) => {
    iniciarModelo();
    return res.json({ success: true, modelo_listo: modeloListo() });
};
