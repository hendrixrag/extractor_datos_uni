let selectedFile = null;
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const fileInfo = document.getElementById("fileInfo");

window.onload = function () {
  alert(
    "Bienvenido a la herramienta de extracción de datos para profesores de la UNEFA\n\n" +
      "Esta herramienta te permite extraer datos de estudiantes desde un archivo PDF y " +
      "convertirlos a Excel.\n\nPor favor, selecciona un archivo PDF que contenga la " +
      "información de los estudiantes (MATRICULA + NOMBRES Y APELLIDOS) y haz clic en Convertir a Excel para iniciar el proceso."
  );
};

// Prevenir comportamientos por defecto
const preventDefaults = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

// Eventos para el highlight
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("highlight");
    },
    false
  );
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(
    eventName,
    (e) => {
      preventDefaults(e);
      dropZone.classList.remove("highlight");
    },
    false
  );
});

// Manejar archivos soltados
dropZone.addEventListener(
  "drop",
  (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  },
  false
);

// Botón de selección
selectBtn.addEventListener("click", () => fileInput.click());

// Input de archivo
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    handleFile(fileInput.files[0]);
  }
});

// Procesar archivo
function handleFile(file) {
  if (file.type !== "application/pdf") {
    fileInfo.innerHTML =
      '<p style="color: red;">Por favor, sube solo archivos PDF</p>';
    return;
  }
  selectedFile = file;
  fileInfo.innerHTML = `
        <p>Archivo seleccionado: <strong>${file.name}</strong></p>
        <p>Tamaño: ${(file.size / 1024).toFixed(2)} KB</p>
    `;
  console.log("Archivo seleccionado:", file);
  document.getElementById("convertBtn").disabled = false; // Habilita el botón
}

// Función de conversión
async function convertToExcel() {
  if (!selectedFile) return alert("No hay archivo seleccionado");

  try {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const typedArray = new Uint8Array(e.target.result);

      // Cargar PDF
      const loadingTask = pdfjsLib.getDocument(typedArray);
      const pdf = await loadingTask.promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(" ");
      }
      //extracción con regex (V + cedula + nombre + apellido)
      const regex = /([A-Z]-\d{8,}\s\D+)\s/g;
      let match;
      const datosExtraidos = [];
      datosExtraidos.push(["Cedula", "Apellidos", "Nombre"]); // Encabezados
      while ((match = regex.exec(fullText)) !== null) {
        const cedula = match[0].match(/[A-Z]-\d{8,}/g)[0]; // Extrae la cédula
        const nombreCompleto = match[0]
          .replace(/[A-Z]-\d{8,}/g, " ") //reemplazar lo encontrado por un espacio
          .trim(); // Eliminar el espacio en blanco al inicio y al final
        // Separar nombres y apellidos
        const { apellidos, nombres } = separarNombres(nombreCompleto);
        console.log(apellidos);
        datosExtraidos.push(
          [cedula, apellidos, nombres] || "" // Agrega como una fila
        );
      }

      // Crear Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(datosExtraidos); // Usa aoa_to_sheet para arrays de arrays
      XLSX.utils.book_append_sheet(wb, ws, "Datos");

      // Descargar
      XLSX.writeFile(wb, "datos_extraidos.xlsx");
    };
    reader.readAsArrayBuffer(selectedFile);
  } catch (error) {
    console.error(error);
    alert("Error al procesar el PDF: " + error.message);
  }
}

function separarNombres(nombreCompleto) {
  const nombreSeparado = nombreCompleto.trim().split(/\s+/);
  const particulas = ["DE", "DEL", "LA", "LOS", "LAS", "Y"];
  const nombresCortos = ["LEO", "LUZ", "MAR", "SOL", "PEPE"];

  let nombres = [];
  let apellido = [];
  let i = 0;

  // Primera palabra siempre es nombre
  if (nombreSeparado.length > 0) nombres.push(nombreSeparado[i++]);
  // Siguientes nombreSeparado: verificar si son partículas o apellidos compuestos
  while (i < nombreSeparado.length) {
    const nombre = nombreSeparado[i];
    const esParticula = particulas.includes(nombre);
    const esNombreCorto = nombresCortos.includes(nombre);

    // Evaluar si es partícula o es un nombre corto
    if (esParticula || esNombreCorto) {
      nombres.push(nombre);
      i++;
      nombres.push(nombreSeparado[i]); // Agregar el siguiente nombre
      i++;
    } else if (nombres.length < 2) {
      nombres.push(nombre);
      i++;
      // Agregar el siguiente nombre
    } else {
      break; // Detenerse cuando se encuentra un apellido
    }
  }

  // Lo que queda son los apellidos
  let apellidos = nombreSeparado.slice(i);

  apellidos = apellidos
    .join(" ") // Unir las palabras en una sola cadena
    .replace(/Firma|Coordinador|Profesor|Fecha|____/g, "") // Eliminar palabras no deseadas y guiones bajos
    .trim() // Eliminar espacios en blanco al inicio y al final
    .split(/\s+/); // Volver a dividir en un array

  return {
    apellidos: apellidos.join(" "), // Unir nuevamente los apellidos en una cadena
    nombres: nombres.join(" "),
  };
}
