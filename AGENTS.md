# AGENTS.md - Directrices para Agentes de IA y Desarrolladores

Este documento establece las convenciones de diseno, invariantes arquitectonicas, restricciones tecnicas y procedimientos de verificacion para agentes de inteligencia artificial y desarrolladores que trabajen en el repositorio **Pain Cave**.

---

## 1. Vision General del Proyecto

Pain Cave es una aplicacion web de entrenamiento ciclista indoor (rodillo/gimnasio) orientada a su visualizacion en smartphones montados sobre el manillar (pantallas moviles de gama de entrada/media como Redmi 14C / 15C).

Principios clave de diseno:
* **KISS (Keep It Simple, Stupid)**: Interfaz minimalista, limpia, sin banners redundantes ni saturacion de texto. La informacion critica debe leerse de un vistazo con vibraciones y sudor.
* **100% Client-Side**: Sin backend, sin empaquetadores (Webpack, Vite, Rollup) ni librerias de runtime complejas.
* **Privacidad Total**: Datos almacenados unicamente en `localStorage`.

---

## 2. Invariantes de la Arquitectura

### 2.1. Modulos de JavaScript (ES Modules nativos)
* Todo el codigo reside en `js/` y se carga mediante `<script type="module" src="./js/app.js">`.
* Los modulos deben mantener bajo acoplamiento y responsabilidades claramente delimitadas:
  * `app.js`: Orquestador principal e integracion de eventos del ciclo de vida. Expone `window.painCaveApp`.
  * `engine.js`: Temporizador de sesion, bucle `requestAnimationFrame`/`setInterval`, visibilidad en segundo plano.
  * `ui.js`: Control visual del DOM, transiciones de modales y renderizado del cockpit.
  * `workouts.js`: Estructura inmutable de rutinas, fases y perfiles SVG.
  * `trainingTracker.js`: Microciclo rotativo de 4 dias, navegacion del calendario y estado del plan.
  * `bluetooth.js`: Capa Web Bluetooth API para pulsometros BLE (servicio 0x180D).
  * `audio.js`: Sintesis de voz (Web Speech API) y generador de tonos (Web Audio API).
  * `gamification.js`: Calculo de zonas cardiacas, XP, rachas semanales y rangos.
  * `exporter.js`: Serializacion XML a formato TCX para Strava y Garmin.
  * `storage.js`: Acceso seguro y tipado a `localStorage`.

### 2.2. Restriccion Critica de Tailwind CSS
* **No existe compilador JIT en tiempo de ejecucion ni paso de build**.
* El archivo `assets/css/tailwind.min.css` es un artefacto estatico precompilado con un conjunto fijo de utilidades.
* **Regla estricta**: Si se introduce una clase de color, borde o fondo personalizada (como `#FC5200`, `#121212`, `#1E1E1E`), **DEBE** declararse explicitamente la regla CSS correspondiente dentro del bloque `<style>` de `index.html`. No asumir que clases arbitrarias tipo `bg-[#...]` o `text-[#...]` funcionaran solas sin regla CSS definida.

### 2.3. Jerarquia del DOM y Modales
* Todos los dialogos modales (`preWorkoutModal`, `summaryModal`, `resumeModal`, `customModal`, `exitModal`, `statsModal`) **deben residir estrictamente dentro de `<div id="modalOverlay">`**.
* **Prohibido**: Incluir botones de "Volver", "Cancelar" o elementos flotantes de modales fuera del contenedor `#modalOverlay`. Esto genera elementos huerfanos visibles en la pantalla principal.

---

## 3. Modelo Fisiologico y Microciclo Rotativo

### 3.1. Zonas Cardiacas y Formulas
Todas las zonas se calculan dinamicamente a partir de la Frecuencia Cardiaca Maxima (`maxHR`, por defecto 189 BPM):

| Zona / Fase | Rango Porcentual | Rango BPM (FC Max = 189) | Objetivo Fisiologico |
| :--- | :--- | :--- | :--- |
| **Zona 1 (Z1)** | Menor a 60% | < 113 BPM | Recuperacion activa, flujo capilar |
| **Zona 2 (Z2)** | 60% a 74% | 113 - 140 BPM | Base aerobica, eficiencia lipidica |
| **Zona 3 (Z3)** | 75% a 85% | 142 - 161 BPM | Tempo aerobico sostenido |
| **Sweet Spot (SS)** | 83% a 88% | 157 - 166 BPM | Densidad mitocondrial sin fatiga excesiva |
| **Zona 4 (Z4)** | 85% a 94% | 161 - 178 BPM | Umbral anaerobico / lactato |
| **Zona 5 (Z5)** | 94% a 100% | 178 - 189 BPM | VO2 Max, tolerancia anaerobica |

*Nota sobre solapamiento*: Sweet Spot no es una zona formal Coggan sino un rango cruzado de alta eficiencia (83-88%). Zona 4 inicia formalmente en 85% segun las especificaciones calibradas del usuario.

### 3.2. Microciclo Rotativo de 4 Dias
La aplicacion utiliza un ciclo continuo desacoplado de los dias fijos de la semana:
* `Dia 1`: Fondo Aerobico Z2 (sesiones de 60 minutos).
* `Dia 2`: Series Sweet Spot (ej. 2x15m, 3x10m, intervalos sub-umbral).
* `Dia 3`: Recuperacion Activa Z1 (o Z2 muy suave, 30-45 minutos).
* `Dia 4`: Descanso Total (asimilacion muscular y descanso neurologico).

La funcion `getCycleDayForDate(dateStr, anchorDate, anchorDay)` en `trainingTracker.js` calcula mediante modulo 4 el dia que corresponde a cualquier fecha del calendario.

---

## 4. Paleta Visual Strava Dark

* Fondo general: `#121212`
* Tarjetas principales / Modales: `#1E1E1E`
* Cajas de datos / Tiles secundarios: `#252525`
* Superficies internas / Inputs: `#181818` / `#161616`
* Bordes sutiles: `#2D2D2D` y `#333333`
* Acento principal (Strava Orange): `#FC5200` (Hover: `#E04800`)
* Tipografia de datos: `font-mono tabular-nums`

---

## 5. Protocolo de Verificacion para Agentes

Antes de dar por completado cualquier cambio, un agente debe ejecutar las siguientes comprobaciones obligatorias en el entorno terminal:

### Paso 1: Comprobacion de Sintaxis de Modulos
Verificar que ningun archivo contenga errores de sintaxis o llaves huerfanas:
```bash
node --check js/*.js
```

### Paso 2: Verificacion de Carga e Inicializacion de ES Modules
Simular la resolucion de modulos e importacion limpia en Node.js:
```bash
node -e "
global.window = { addEventListener: () => {} };
global.document = { addEventListener: () => {}, getElementById: () => ({ classList: { add:()=>{}, remove:()=>{} }, style:{} }) };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
import('./js/app.js').then(() => console.log('Modulos cargados exitosamente'));
"
```

### Paso 3: Verificacion del DOM y Estilos
* Confirmar que no existan clases arbitrarias sin su respectiva declaracion en el bloque `<style>` de `index.html`.
* Confirmar con `grep -n "Volver" index.html` que solo existan botones de retorno dentro de `#modalOverlay`.
