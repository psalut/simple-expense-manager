---
name: Casa
description: Sistema visual mobile-first para gastos personales y compartidos, cálido, íntimo y práctico.
colors:
  bordeaux-accion: "#6A041D"
  grey-olive-acompanamiento: "#778174"
  ash-grey-superficie: "#A1A89F"
  bone-neutro-calido: "#EDE5D6"
  neutro-blanco: "oklch(1 0 0)"
  neutro-tinta: "oklch(0.145 0 0)"
  neutro-superficie-suave: "oklch(0.97 0 0)"
  neutro-texto-secundario: "oklch(0.556 0 0)"
  neutro-borde: "oklch(0.922 0 0)"
  estado-destructivo: "oklch(0.577 0.245 27.325)"
typography:
  body:
    fontFamily: "Inter, sans-serif"
  mono:
    fontFamily: "Geist Mono, monospace"
rounded:
  base: "10px"
  control: "16px"
  card: "24px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.bordeaux-accion}"
    textColor: "{colors.neutro-blanco}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.neutro-blanco}"
    textColor: "{colors.neutro-tinta}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.bone-neutro-calido}"
    textColor: "{colors.neutro-tinta}"
    rounded: "{rounded.card}"
---

# Design System: Casa

## Overview

**Creative North Star: "Casa serena"**

Casa se siente cálida, íntima y práctica: acompaña la organización cotidiana de dos personas sin convertir cada gasto en una alerta. La paleta aprobada combina un bordó reservado para acciones clave con verdes apagados de acompañamiento y un neutro hueso cálido. El blanco y la tinta oscura actuales siguen sosteniendo la legibilidad y la claridad.

La experiencia conserva el enfoque mobile-first y la identidad Rhea que ya usa la aplicación. Los botones y superficies deben sentirse más táctiles, con elevación perceptible donde ayude a reconocer una acción o una capa. Esta dirección queda documentada para la futura aplicación de color; los estilos activos todavía son los definidos en `src/app/globals.css`.

**Key Characteristics:**
- Cálida, serena e íntima, con una jerarquía práctica.
- Bordó escaso para acciones importantes y estados seleccionados.
- Verdes de apoyo y superficies hueso equilibrados con blanco y tinta de alto contraste.
- Controles y superficies táctiles, con elevación usada para comunicar interacción y profundidad.
- Criterio visual consistente entre Gastos, Casa y Categorías.

## Colors

La paleta aprobada agrega calidez y reconocimiento sin reemplazar los neutros funcionales ni los colores semánticos del producto. Estos cuatro colores son tokens de destino para una etapa posterior; todavía no están aplicados a la interfaz.

### Primary
- **Bordeaux** (`#6A041D`): acento primario para acciones clave —por ejemplo, crear o guardar—, selección y foco visible sobre superficies claras. Combina con texto blanco o Bone y no representa errores.

### Secondary
- **Grey Olive** (`#778174`): acento secundario de acompañamiento para marcadores, iconografía y límites funcionales puntuales, como el borde de un campo. Evitarlo en texto pequeño sobre blanco o Bone por contraste insuficiente.

### Tertiary
- **Ash Grey** (`#A1A89F`): tinte de apoyo para superficies amplias y detalles decorativos no esenciales. No usar en texto, iconos importantes, indicadores de foco ni límites que deban reconocerse para operar.
- **Bone** (`#EDE5D6`): neutro cálido para superficies suaves o capas de contenido. Mantener también superficies blancas para preservar el aspecto limpio de Rhea.

### Neutral
- **Blanco** (`oklch(1 0 0)`): fondo principal actual y superficie de campos.
- **Tinta oscura** (`oklch(0.145 0 0)`): texto principal y contenido de alto contraste.
- **Gris suave** (`oklch(0.97 0 0)`): superficie secundaria, sutilmente separada del fondo.
- **Texto secundario** (`oklch(0.556 0 0)`): información auxiliar; verificar contraste con cada nueva superficie.
- **Borde neutro** (`oklch(0.922 0 0)`): divisores discretos existentes. Para límites esenciales de controles, usar un borde que alcance el contraste no textual requerido.

Los roles destructivo, éxito y advertencia siguen siendo semánticos e independientes de la marca. Conservar el rojo destructivo existente, el verde de éxito ya usado y un color de advertencia legible cuando ese estado aparezca; Bordeaux no significa error y los verdes de marca no significan éxito automáticamente.

Los contrastes calculados en sRGB según la fórmula WCAG son: Bordeaux con Bone **10.18:1** y con blanco **12.74:1**; Grey Olive con Bone **3.24:1** y con blanco **4.06:1**; Ash Grey con Bone **1.95:1** y con blanco **2.44:1**; Bone con blanco **1.25:1**. Bordeaux supera WCAG AA para texto normal en ambas superficies. Grey Olive no llega a 4.5:1 para texto normal sobre ninguna de ellas, aunque sí llega a 3:1 para elementos no textuales sobre blanco y Bone. Ash Grey y Bone no deben depender del contraste por sí solos para diferenciar información o límites.

Cuando Bone se apoye sobre blanco, reforzar la separación con una elevación o un borde que sí contraste: los dos rellenos son demasiado parecidos para comunicar por sí solos un límite interactivo. Los estados no se distinguen solamente por color: usar texto, icono o forma además del tono.

### Named Rules
**The Accent Rarity Rule.** Bordeaux aparece en acciones clave, selección y foco; su uso medido mantiene clara la jerarquía.

**The Contrast Before Warmth Rule.** Una superficie cálida nunca justifica texto, iconos o límites funcionales con contraste insuficiente.

## Typography

**Display Font:** Inter (con fallback sans-serif); **Body Font:** Inter (con fallback sans-serif); **Label/Mono Font:** Geist Mono (solo donde el contenido técnico lo justifique).

**Character:** Inter conserva la lectura directa y familiar de la interfaz. Geist Mono queda reservado para valores o referencias técnicas, no para competir con títulos y montos.

### Hierarchy
- **Headline** (semibold, según la escala existente): títulos de sección como Gastos, Casa y Categorías.
- **Title** (semibold, según la escala existente): encabezados de grupos y diálogos.
- **Body** (regular, según la escala existente): nombres, descripciones y contenido cotidiano.
- **Label** (regular o medium, según la escala existente): metadatos y acciones secundarias; evitar reducir texto importante para ganar espacio.

Mantener los tamaños ya presentes en el sistema hasta que se defina una revisión tipográfica. Priorizar alineación y jerarquía antes que añadir familias o estilos decorativos.

## Layout

La estructura parte de una sola columna y prioriza el uso con una mano en móvil. Mantener los márgenes de página y la navegación inferior observados: 16 px de gutter base, 24 px en el breakpoint `sm` cuando corresponda, navegación móvil de al menos 64 px más el inset seguro del dispositivo y un ancho máximo de 48 rem para Casa. Agrupar los gastos por mes con el patrón común de la app.

La escala de espacio se basa en incrementos de 4 px, con pasos frecuentes de 8, 12, 16 y 24 px. Usar separación y líneas para estructurar listas; reservar superficies distintas para cambios de contexto reales y no para cada fila.

**The Same House Rule.** Gastos, Casa y Categorías comparten jerarquía de títulos, márgenes, comportamiento del botón flotante y estados de navegación. Las diferencias entre secciones deben responder a su contenido, no a estilos arbitrarios.

## Elevation & Depth

La dirección aprobada es táctil y por capas: botones y superficies deben tener más elevación que en la materialidad plana actual. La elevación refuerza la acción y la separación entre planos; no debe reemplazar una jerarquía clara ni introducir sombras pesadas en cada fila. Los valores de sombra del sidecar son propuestas de referencia para la etapa de colorize, no tokens activos de la aplicación.

Usar elevación más evidente en botones de acción y FAB; una sombra suave en tarjetas o superficies interactivas; y una elevación superior en diálogos. Las listas y el fondo pueden seguir siendo tranquilos. Acompañar hover con una elevación leve, active con una pequeña presión hacia abajo y focus-visible con un anillo de alto contraste. Respetar `prefers-reduced-motion` al aplicar transiciones.

**The Layered Touch Rule.** La elevación comunica qué se puede tocar y qué está por encima; debe ser más visible en controles accionables que en contenido pasivo.

## Shapes

Conservar la geometría redondeada de Rhea: radio base observado de 10 px, controles de 16 px y tarjetas de hasta 24 px. Preferir esquinas suaves y consistentes, con controles cómodos y superficies amplias; no convertir cada fila o divisor en una tarjeta independiente.

## Components

### Buttons
- **Shape:** controles redondeados (16 px), con altura táctil mínima de 44 px; el FAB actual tiene 56 px.
- **Primary:** en la dirección futura, fondo Bordeaux y texto blanco para la acción principal de una vista.
- **Hover / Focus:** hover con un cambio sutil de elevación; `focus-visible` con anillo Bordeaux bien contrastado y separación visible del control.
- **Active / Disabled:** active con breve presión hacia abajo. Disabled conserva texto identificable y semántica de deshabilitado; no depende solo de bajar opacidad.
- **Secondary / Ghost:** mantenerlos visualmente subordinados, con superficie o borde legible y sin competir con la acción principal.

### Cards / Containers
- **Corner Style:** redondeo amplio de hasta 24 px.
- **Background:** combinar blanco actual y Bone propuesto para capas con propósito.
- **Shadow Strategy:** elevación táctil moderada en superficies interactivas; verificar el límite mediante borde o sombra cuando Bone esté sobre blanco.
- **Internal Padding:** usar la escala común, con 16 px como base habitual y 24 px en contenedores más amplios cuando el espacio lo permita.

### Inputs / Fields
- **Style:** fondo claro, texto tinta y borde funcional con contraste suficiente; Grey Olive puede servir para el borde si conserva al menos 3:1 frente al campo.
- **Focus:** borde y anillo Bordeaux visibles, sin depender de un cambio de tono sutil.
- **Error / Disabled:** el error mantiene su color semántico destructivo y un mensaje asociado; el estado deshabilitado sigue siendo comprensible.

### Navigation
- **Style:** navegación inferior móvil con tres secciones, icono y etiqueta. El estado activo puede usar Bordeaux y un indicador de forma o posición; los estados inactivos mantienen contraste y legibilidad. Respetar el inset seguro inferior de iOS.

### Floating Action Button
- Mantener una acción flotante coherente entre Gastos, Casa y Categorías, con objetivo táctil de 56 px, elevación clara y separación suficiente del contenido y la navegación inferior.

## Do's and Don'ts

### Do:
- **Do** reservar Bordeaux para acciones clave, selección y foco.
- **Do** usar Grey Olive como acento de apoyo y como límite funcional solo cuando el contraste cumpla el mínimo no textual.
- **Do** limitar Ash Grey a superficies y elementos no esenciales.
- **Do** distinguir Bone del blanco con una señal de profundidad o límite accesible.
- **Do** mantener rojo destructivo, verde de éxito y advertencia como estados semánticos separados de la marca.
- **Do** proporcionar objetivos táctiles de al menos 44 px para controles principales y estados de foco visibles por teclado.
- **Do** comprobar estados hover, focus-visible, active y disabled con contraste y movimiento reducido.
- **Do** repetir los patrones principales en Gastos, Casa y Categorías.

### Don't:
- **Don't** usar Grey Olive como texto pequeño sobre blanco o Bone.
- **Don't** usar Ash Grey para texto, foco, iconos esenciales o límites de controles.
- **Don't** usar Bone sobre blanco como única señal de separación.
- **Don't** codificar éxito, advertencia o error solamente con el color de marca.
- **Don't** extender sombras fuertes a todas las filas o elementos pasivos.
- **Don't** aplicar la paleta aprobada a los estilos activos hasta el paso de implementación de color.
