import sys
import json
import cv2
import numpy as np
import os

# Configuración inicial del entorno
os.environ["YOLO_CONFIG_DIR"] = "/tmp"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

print("Python iniciado", file=sys.stderr, flush=True)

try:
    from ultralytics import YOLO
    print("YOLO importado", file=sys.stderr, flush=True)
except Exception as e:
    print(f"Error al importar YOLO: {e}", file=sys.stderr, flush=True)
    sys.exit(1)

try:
    print("Importando TensorFlow...", file=sys.stderr, flush=True)
    import tensorflow as tf
    print("TensorFlow importado", file=sys.stderr, flush=True)
except Exception as e:
    print(f"Error al importar TensorFlow: {e}", file=sys.stderr, flush=True)
    sys.exit(1)

# Rutas de los modelos (ajustadas a la estructura estándar del proyecto)
ruta_yolo = "src/modelos/best.pt"
ruta_tflite = "src/modelos/modelo_clasificacion.tflite"

print("Cargando YOLO...", file=sys.stderr, flush=True)
if not os.path.exists(ruta_yolo):
    print(f"⚠️ Advertencia: No se encuentra el archivo de YOLO en {ruta_yolo}", file=sys.stderr, flush=True)
modelo_yolo = YOLO(ruta_yolo)
print("YOLO cargado correctamente", file=sys.stderr, flush=True)

print("Cargando modelo TFLite...", file=sys.stderr, flush=True)
if not os.path.exists(ruta_tflite):
    print(f"❌ Error crítico: No se encuentra el archivo TFLite en {ruta_tflite}", file=sys.stderr, flush=True)
    sys.exit(1)

interpreter = tf.lite.Interpreter(model_path=ruta_tflite)
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
    # Redimensionar a 224x224
    imagen = cv2.resize(imagen, (224, 224))

    # BGR -> RGB
    imagen = cv2.cvtColor(imagen, cv2.COLOR_BGR2RGB)

    # Convertir a float32 y escalar si fue entrenado con [0, 1]
    imagen = imagen.astype(np.float32)

    # Añadir dimensión de lote [1, 224, 224, 3]
    imagen = np.expand_dims(imagen, axis=0)

    # Ejecutar inferencia con TFLite
    interpreter.set_tensor(input_details[0]["index"], imagen)
    interpreter.invoke()

    pred = interpreter.get_tensor(output_details[0]["index"])[0]

    indice = int(np.argmax(pred))
    confianza = float(pred[indice])

    return class_names[indice], confianza

# ==========================
# DETECCIÓN CON YOLO
# ==========================
def detectar_regiones(ruta_imagen):
    imagen = cv2.imread(ruta_imagen)

    if imagen is None:
        print(f"❌ Error: OpenCV no pudo leer la imagen en la ruta: {ruta_imagen}", file=sys.stderr, flush=True)
        return None, []

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
    print(f"Procesando imagen desde: {ruta_imagen}", file=sys.stderr, flush=True)
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
        print(f"Excepción capturada en el Main: {str(e)}", file=sys.stderr, flush=True)
        print(json.dumps({
            "success": False,
            "mensaje": str(e)
        }))