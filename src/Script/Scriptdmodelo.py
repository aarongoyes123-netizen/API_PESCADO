import sys
import json
import cv2
import numpy as np
import os

print("Python iniciado", file=sys.stderr, flush=True)


from ultralytics import YOLO

print("YOLO importado", file=sys.stderr, flush=True)


print("Antes TensorFlow", file=sys.stderr, flush=True)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

print("Saltando TensorFlow", file=sys.stderr, flush=True)

modelo_clasificacion = None

print("TensorFlow importado", file=sys.stderr, flush=True)


#*print("Cargando YOLO...", file=sys.stderr, flush=True)

modelo_yolo = None

print("YOLO cargado", flush=True)


print("Cargando clasificación...", flush=True)

#*modelo_clasificacion = load_model(
    #"src/modelos/modelo_clasificacion.keras"
#)

print("Clasificador cargado", flush=True)
# Clases del modelo de clasificación
class_names = [
    "deteriorado",
    "fresco",
    "regular"
]

# ==========================
# CLASIFICADOR
# ==========================

def clasificar_imagen(imagen):

    imagen = cv2.resize(imagen, (224, 224))

    imagen = np.expand_dims(imagen, axis=0)

    pred = modelo_clasificacion.predict(imagen, verbose=0)

    indice = np.argmax(pred)

    confianza = float(np.max(pred))

    return class_names[indice], confianza
# ==========================
# DETECCIÓN CON YOLO
# ==========================

def detectar_regiones(ruta_imagen):

    imagen = cv2.imread(ruta_imagen)

    if imagen is None:
        return None, []

    resultados = modelo_yolo(ruta_imagen)

    regiones = []

    for resultado in resultados:

        for box in resultado.boxes:

            clase = int(box.cls[0])

            nombre = resultado.names[clase]

            confianza = float(box.conf[0])

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Evitar coordenadas fuera de la imagen
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(imagen.shape[1], x2)
            y2 = min(imagen.shape[0], y2)

            roi = imagen[y1:y2, x1:x2]

            if roi.size == 0:
                continue

            regiones.append({
                "clase": nombre,
                "confianza_deteccion": confianza,
                "roi": roi
            })

    return imagen, regiones
# ==========================
# PROCESAR LA IMAGEN
# ==========================

def procesar_imagen(ruta_imagen):

    imagen, regiones = detectar_regiones(ruta_imagen)

    if imagen is None:
        return {
            "success": False,
            "mensaje": "No se pudo abrir la imagen."
        }

    resultados = []

    for region in regiones:

        clase_detectada = region["clase"]

        roi = region["roi"]

        clase_predicha, confianza = clasificar_imagen(roi)

        resultados.append({

            "objeto_detectado": clase_detectada,

            "confianza_deteccion": round(
                region["confianza_deteccion"] * 100,
                2
            ),

            "clasificacion": clase_predicha,

            "confianza_clasificacion": round(
                confianza * 100,
                2
            )

        })

    return {

        "success": True,

        "cantidad_objetos": len(resultados),

        "resultados": resultados

    }
# ==========================
# MAIN
# ==========================

if __name__ == "__main__":

    try:

        if len(sys.argv) < 2:

            print(json.dumps({
                "success": False,
                "mensaje": "No se recibió la ruta de la imagen."
            }))

            sys.exit()

        ruta = sys.argv[1]

        respuesta = procesar_imagen(ruta)

        print(json.dumps(respuesta))

    except Exception as e:

        print(json.dumps({

            "success": False,

            "mensaje": str(e)

        }))