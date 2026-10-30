# Pain Cave

Pain Cave es una aplicacion web ligera y autonoma disenada para el entrenamiento ciclista en rodillo y gimnasio. Funciona completamente del lado del cliente, sin dependencias de backend ni herramientas de compilacion, ofreciendo un cockpit interactivo de alta legibilidad, seguimiento de zonas de frecuencia cardiaca mediante Bluetooth (BLE), guia por voz y gestion de microciclos rotativos.

---

## Caracteristicas Principales

### Cockpit de Entrenamiento
* Temporizador circular con animacion sincronizada y barra de perfil de sesion en tiempo real.
* Metronomo visual de cadencia (RPM) ajustable segun la fase del entrenamiento.
* Visualizacion de 4 metricas criticas: Cadencia Objetivo, Zona de Frecuencia Cardiaca, Pulso Real (BLE) y Percepcion Subjetiva del Esfuerzo (RPE).
* Controles adaptados para uso en manillar y dispositivos moviles: saltar intervalo, ajuste rapido (+/-15s), pausa y finalizacion segura.

### Microciclo Rotativo de 4 Dias
Estructura de entrenamiento disenada para evitar la acumulacion de fatiga y desacoplarse de la rigidez de dias fijos de la semana:
* Dia 1: Zona 2 (Resistencia Aerobica Base, 60 minutos).
* Dia 2: Sweet Spot / Umbral (Series fraccionadas de calidad).
* Dia 3: Zona 1 / Recuperacion Activa (Regeneracion vascular).
* Dia 4: Descanso Total (Asimilacion muscular completa).

### Calibracion Fisiologica de Zonas
Calculo dinamico de zonas cardiacas basado en la Frecuencia Cardiaca Maxima (por defecto calibrado a 189 BPM):
* Zona 1 (Recuperacion activa): Menor a 60% FC Max (< 113 BPM).
* Zona 2 (Fondo aerobico): 60% a 74% FC Max (113 - 140 BPM).
* Zona 3 (Tempo): 75% a 85% FC Max (142 - 161 BPM).
* Sweet Spot (Sub-umbral): 83% a 88% FC Max (157 - 166 BPM).
* Zona 4 (Umbral lactico): 85% a 94% FC Max (161 - 178 BPM).
* Zona 5 (Consumo maximo de oxigeno VO2 Max): 94% a 100% FC Max (178 - 189 BPM).

### Conectividad y Audio
* Sensor Cardiaco BLE: Conexion nativa via Web Bluetooth API con bandas de pecho y brazaletes compatibles con el servicio estandar Heart Rate (UUID 0x180D).
* Guia por Voz: Sintesis de voz del navegador (Web Speech API) con avisos de inicio de fase, objetivos de cadencia, cuentas regresivas y advertencias de zona.
* Exportacion a Strava: Generacion y descarga de archivos en formato TCX con marcas de tiempo, frecuencia cardiaca segundo a segundo y gasto calorico estimado.

### Interfaz y Rendimiento
* Diseno oscuro atletico de alto contraste inspirado en Strava (fondo neutro #121212, tarjetas #1E1E1E y acento #FC5200).
* Tipografia numerica tabular monospaced para evitar saltos visuales durante la lectura en movimiento.
* Calendario interactivo navegable mes a mes con visualizacion del cumplimiento historico y detalle de sesiones.
* Almacenamiento 100% local en localStorage con opcion de copia de seguridad (exportacion/importacion JSON).

---

## Arquitectura del Proyecto

El proyecto sigue una arquitectura modular en JavaScript estandar (ES Modules), sin empaquetadores (Webpack/Vite) ni frameworks adicionales:

```text
paincave/
├── assets/
│   ├── css/
│   │   ├── tailwind.min.css       # Hoja de estilos base precompilada
│   │   └── tabler-icons.min.css   # Iconografia Tabler local
│   └── icons/                     # Iconos y favicons
├── js/
│   ├── app.js                     # Controlador principal y orquestador del ciclo de vida
│   ├── engine.js                  # Motor del cronometro, bucle temporal y visibilidad
│   ├── ui.js                      # Manipulacion de la interfaz, modales y renderizado
│   ├── workouts.js                # Definicion del catalogo de rutinas y fases
│   ├── trainingTracker.js         # Logica del microciclo rotativo de 4 dias y plan
│   ├── bluetooth.js               # Integracion Web Bluetooth API (Heart Rate GATT)
│   ├── audio.js                   # Web Audio API (beeps) y Web Speech API (voz)
│   ├── gamification.js            # Sistema de XP, rachas, rangos y zonas cardiacas
│   ├── exporter.js                # Generador de archivos de entrenamiento en formato TCX
│   └── storage.js                 # Capa de persistencia local en el navegador
├── index.html                     # Punto de entrada HTML y reglas CSS especificas
├── README.md                      # Documentacion del proyecto
└── AGENTS.md                      # Directrices tecnicas para agentes de inteligencia artificial
```

---

## Requisitos y Compatibilidad

* Navegador compatible con ES Modules y Web Bluetooth API (Google Chrome, Microsoft Edge, Brave u Opera en Android, Linux, macOS o Windows).
* Para la conexion de sensores de frecuencia cardiaca en dispositivos moviles, se requiere Bluetooth activado y permisos de ubicacion/dispositivos cercanos segun las politicas del sistema operativo.
* No requiere conexion a internet activa para entrenar una vez cargada la aplicacion.

---

## Puesta en Marcha

Al ser una aplicacion web estatica basada en modulos de JavaScript, debe servirse a traves de un servidor HTTP local (los modulos ES restringen el protocolo `file://` por politicas de seguridad CORS del navegador).

### Opcion 1: Con Python (incorporado en la mayoria de sistemas)
```bash
# Python 3
python3 -m http.server 8080
```
Abrir `http://localhost:8080` en el navegador.

### Opcion 2: Con Node.js
```bash
npx serve -l 8080
```

### Opcion 3: Con la extension Live Server en VS Code
Hacer clic derecho sobre `index.html` y seleccionar "Open with Live Server".

---

## Importacion de Entrenamientos Personalizados (CSV)

La aplicacion permite cargar estructuras de entrenamiento personalizadas pegando texto plano o subiendo un archivo `.csv` con el siguiente formato:

```csv
Fase, Cadencia, RPE, Segundos
Calentamiento, 90, 4, 300
Sweet Spot 1, 85, 8, 600
Recuperacion, 90, 4, 180
Sweet Spot 2, 85, 8, 600
Enfriamiento, 85, 3, 300
```

---

## Privacidad y Datos

Pain Cave no recopila datos de telemetria, cookies analiticas ni informacion personal. Todo el historial de entrenamiento, la configuracion de zonas y las metricas de frecuencia cardiaca residen exclusivamente en el almacenamiento local (`localStorage`) de su navegador web.
