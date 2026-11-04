
const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(process.argv[2] || "citas-barber");
const destination = path.resolve(
  process.argv[3] || "AgendaPro"
);

if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  console.error("No se encontró la carpeta del proyecto:", source);
  process.exit(1);
}

if (source === destination || destination.startsWith(source + path.sep)) {
  console.error("La carpeta de destino debe estar fuera de la carpeta original.");
  process.exit(1);
}

if (fs.existsSync(destination)) {
  console.error("El destino ya existe. Elige otra carpeta para no sobrescribir datos.");
  process.exit(1);
}

fs.cpSync(source, destination, { recursive: true });

const extensions = new Set([".html", ".css", ".js"]);
const changedFiles = [];

function replaceAll(text, pairs) {
  for (const [from, to] of pairs) {
    text = text.split(from).join(to);
  }
  return text;
}

const visibleReplacements = [
  ["ELEGANT BARBER SHOP", "AgendaPro"],
  ["ELEGANT BARBERSHOP", "AgendaPro"],
  ["Elegant Barbershop", "AgendaPro"],
  ["BARBER SHOP", "AgendaPro"],
  ["Barberos", "Personal"],
  ["barberos", "profesionales"],
  ["Barbero", "Profesional"],
  ["barbero", "profesional"],
  ["barbería", "negocio"],
  ["Barbería", "Negocio"],
  ["Corte clásico", "Servicio estándar"],
  ["Corte + barba", "Servicio especializado"],
  ["Barba corta.", "Atención personalizada."],
  ["Barba", "Consulta inicial"],
  ["barba", "consulta"],
  ["✂", "◈"]
];

const phrases = [
  ["Administrar profesionales", "Administrar personal"],
  ["Nuevo profesional", "Nuevo integrante"],
  ["Datos del profesional", "Datos del profesional"],
  ["Profesional activo", "Profesional activo"],
  ["Servicio y profesional", "Servicio y profesional"],
  ["Agenda del negocio", "Agenda del negocio"]
];

function transformHtml(content) {
  content = content.replace(
    /<title>[\s\S]*?<\/title>/i,
    match => replaceAll(match, visibleReplacements)
  );

  // Cambiar únicamente texto visible entre etiquetas.
  content = content.replace(
    />([^<>]+)</g,
    (match, text) => {
      const updated = replaceAll(text, visibleReplacements);
      return ">" + replaceAll(updated, phrases) + "<";
    }
  );

  // Actualizar textos de ayuda sin tocar IDs ni rutas.
  content = content.replace(
    /\b(placeholder|aria-label)="([^"]*)"/g,
    (match, attribute, value) =>
      `${attribute}="${replaceAll(value, visibleReplacements)}"`
  );

  return content;
}

function transformCss(content) {
  // Los selectores y variables CSS permanecen intactos.
  // Solo se actualizan comentarios que identifican la marca.
  return content.replace(
    /\/\*[\s\S]*?\*\//g,
    comment => replaceAll(comment, [
      ["ELEGANT BARBERSHOP", "AGENDAPRO"],
      ["ELEGANT BARBER SHOP", "AGENDAPRO"],
      ["Elegant Barbershop", "AgendaPro"]
    ])
  );
}

function transformJs(content) {
  // No cambiar nombres de variables, funciones, propiedades
  // ni identificadores usados por el resto del proyecto.
  // Se reemplazan textos dentro de cadenas de presentación
  // y comentarios, sin alterar las claves internas.

  const replacements = [
    ["Barberos", "Personal"],
    ["Barbero", "Profesional"],
    ["barberos", "profesionales"],
    ["barbero", "profesional"],
    ["barbería", "negocio"],
    ["Barbería", "Negocio"],
    ["Corte clásico", "Servicio estándar"],
    ["Corte + barba", "Servicio especializado"],
    ["Barba corta.", "Atención personalizada."],
    ["Barba", "Consulta inicial"],
    ["✂", "◈"]
  ];

  // Las cadenas completas de identificadores internos
  // no deben transformarse.
  const protectedValues = new Set([
    "barbershop_customers",
    "barbershop_appointments",
    "barbershop_services",
    "barbershop_barbers",
    "barbershop_booking_customer",
    "barberId",
    "barberName",
    "barberPhone",
    "barberModal",
    "barberServices",
    "barberSummary",
    "barbersGrid",
    "appointmentBarber",
    "barbersReport"
  ]);

  // Transformar únicamente cadenas simples o dobles
  // sin escapes complejos.
  content = content.replace(
    /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
    literal => {
      const quote = literal[0];
      const value = literal.slice(1, -1);

      if (
        protectedValues.has(value) ||
        value.includes("barbershop_") ||
        value.includes("barber-") ||
        value.includes("barber_") ||
        value.includes("Barber") && /^[A-Za-z0-9_-]+$/.test(value)
      ) {
        return literal;
      }

      return quote + replaceAll(value, replacements) + quote;
    }
  );

  // Sustituir palabras de presentación en HTML generado
  // mediante template literals, conservando las expresiones.
  content = content.replace(
    /`(?:\\[\s\S]|\$\{[\s\S]*?\}|[^`])*`/g,
    template => {
      return template.replace(
        />([^<>]*?)</g,
        (match, text) =>
          ">" + replaceAll(text, replacements) + "<"
      );
    }
  );

  return content;
}

function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      walk(file);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    if (!extensions.has(ext)) continue;

    const original = fs.readFileSync(file, "utf8");
    let updated = original;

    if (ext === ".html") updated = transformHtml(original);
    if (ext === ".css") updated = transformCss(original);
    if (ext === ".js") updated = transformJs(original);

    if (updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      changedFiles.push(path.relative(destination, file));
    }
  }
}

walk(destination);

const report = [
  "AGENDAPRO - REPORTE DE GENERALIZACIÓN",
  "",
  "Proyecto original: " + source,
  "Proyecto generado: " + destination,
  "",
  "Archivos modificados:",
  ...changedFiles.map(file => "- " + file),
  "",
  "Conservado:",
  "- Rutas y nombres de archivos",
  "- IDs y clases HTML/CSS",
  "- Funciones y variables JavaScript",
  "- Claves existentes de localStorage",
  "- Pestañas y navegación",
  "",
  "IMPORTANTE:",
  "Esta transformación no migra los datos existentes",
  "ni verifica automáticamente los flujos de la aplicación.",
  "Revisa los textos y prueba los módulos antes de publicar."
].join("\n");

fs.writeFileSync(
  path.join(destination, "REPORTE-CAMBIOS.txt"),
  report,
  "utf8"
);

console.log(report);
