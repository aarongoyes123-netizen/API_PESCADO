import sys
import json
import cv2
import numpy as np
import os

os.environ["YOLO_CONFIG_DIR"]="/tmp"
os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"

print("Python iniciado", file=sys.stderr, flush=True)

from ultralytics import YOLO
print("YOLO importado", file=sys.stderr, flush=True)

# 🚨 CAMBIO: Importar TensorFlow correctamente 🚨
print("Importando TensorFlow...", file=sys.stderr, flush=True)
import tensorflow as tf
print("TensorFlow importado", file=sys.stderr, flush=True)

print("Cargando YOLO...", file=sys.stderr, flush=True)
modelo_yolo = YOLO("src/modelos/best.pt")
print("YOLO cargado correctamente", file=sys.stderr, flush=True)

# 🚨 CAMBIO: Cargar el modelo de clasificación Keras 🚨
print("Cargando modelo TFLite...", file=sys.stderr, flush=True)

interpreter = tf.lite.Interpreter(
    model_path="src/modelos/modelo_clasificacion.tflite"
)

interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print("Modelo TFLite cargado correctamente", file=sys.stderr, flush=True)
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

    # Redimensionar
    imagen = cv2.resize(imagen, (224, 224))

    # BGR -> RGB
    imagen = cv2.cvtColor(imagen, cv2.COLOR_BGR2RGB)

    # float32
    imagen = imagen.astype(np.float32)

    # Batch
    imagen = np.expand_dims(imagen, axis=0)

    # Ejecutar inferencia
    interpreter.set_tensor(
        input_details[0]["index"],
        imagen
    )

    interpreter.invoke()

    pred = interpreter.get_tensor(
        output_details[0]["index"]
    )[0]

    indice = int(np.argmax(pred))
    confianza = float(pred[indice])

    return class_names[indice], confianza

# ==========================
# DETECCIÓN CON YOLO
# ==========================
def detectar_regiones(ruta_imagen):
    imagen = cv2.imread(ruta_imagen)

    if imagen is None:
        return None, []

    # =====================================================================
    # INTEGRACIÓN DE ZOOM Y PREPROCESAMIENTO CLAHE (Opcional / Recomendado)
    # =====================================================================
    # Descomenta este bloque si quieres que la API aplique el zoom y contraste 
    # automáticamente a las fotos HD que envía el ESP32 antes de pasar por YOLO.
    
    # alto, ancho, _ = imagen.shape
    # ymin, ymax = int(alto * 0.1), int(alto * 0.9)
    # xmin, xmax = int(ancho * 0.15), int(ancho * 0.85)
    # img_recortada = imagen[ymin:ymax, xmin:xmax]
    # img_zoom = cv2.resize(img_recortada, (ancho, alto), interpolation=cv2.INTER_CUBIC)
    
    # lab = cv2.cvtColor(img_zoom, cv2.COLOR_BGR2LAB)
    # l, a, b = cv2.split(lab)
    # clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    # cl = clahe.apply(l)
    # limg = cv2.merge((cl, a, b))
    # imagen = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    # =====================================================================

    resultados = modelo_yolo(imagen, verbose=False)
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
            "confianza_deteccion": round(region["confianza_deteccion"] * 100, 2),
            "clasificacion": clase_predicha,
            "confianza_clasificacion": round(confianza * 100, 2)
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