// Mantiene UN proceso de Python abierto con los modelos ya cargados.
// Antes se abria Python en cada foto (importar YOLO + cargar modelos = muy lento).
// Ahora se carga una sola vez y cada analisis tarda solo unos segundos.
import { spawn } from 'child_process';
import readline from 'readline';

const TIEMPO_MAX_ANALISIS_MS = 120000; // si Python se cuelga, se reinicia

let proceso = null;
let listo = false;
let actual = null;      // { ruta, resolve, reject, timer }
const cola = [];        // trabajos pendientes, se procesan de uno en uno

function iniciar() {
    if (proceso) return;
    listo = false;
    console.log('MODELO: iniciando Python en modo servidor...');

    proceso = spawn('python', ['src/Script/Scriptdmodelo.py', '--servidor'], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    const rl = readline.createInterface({ input: proceso.stdout });
    rl.on('line', (linea) => {
        linea = linea.trim();
        if (!linea.startsWith('{')) {
            if (linea) console.log('PYTHON(stdout):', linea);
            return;
        }
        let datos;
        try {
            datos = JSON.parse(linea);
        } catch {
            console.log('PYTHON: JSON invalido ->', linea);
            return;
        }
        if (datos.listo) {
            listo = true;
            console.log('MODELO: listo (modelos cargados)');
            siguiente();
            return;
        }
        if (actual) {
            const t = actual;
            actual = null;
            clearTimeout(t.timer);
            t.resolve(datos);
        }
        siguiente();
    });

    proceso.stderr.on('data', (d) => console.log('PYTHON:', d.toString().trim()));

    proceso.on('error', (err) => {
        console.log('MODELO: no se pudo iniciar Python:', err.message);
    });

    proceso.on('close', (code) => {
        console.log('MODELO: Python termino con codigo', code);
        proceso = null;
        listo = false;
        if (actual) {
            clearTimeout(actual.timer);
            actual.reject(new Error('El proceso del modelo se detuvo'));
            actual = null;
        }
        // Reiniciar; los trabajos en cola se procesan cuando vuelva a estar listo
        setTimeout(iniciar, 5000);
    });
}

function siguiente() {
    if (!listo || actual || cola.length === 0 || !proceso) return;
    actual = cola.shift();
    actual.timer = setTimeout(() => {
        console.log('MODELO: analisis demasiado largo, reiniciando Python');
        if (proceso) proceso.kill();
    }, TIEMPO_MAX_ANALISIS_MS);
    proceso.stdin.write(actual.ruta + '\n');
}

export function analizarImagen(ruta) {
    return new Promise((resolve, reject) => {
        cola.push({ ruta, resolve, reject });
        iniciar();
        siguiente();
    });
}

export function iniciarModelo() {
    iniciar();
}

export function modeloListo() {
    return listo;
}