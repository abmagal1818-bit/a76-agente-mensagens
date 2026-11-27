// Este arquivo existe por um motivo tecnico: o codigo completo do agente (index.js
// original) precisou ser dividido em pedacos menores (core-part1.js..core-part6.js)
// para caber no limite de tamanho de uma unica transferencia ao subir pro GitHub.
// Nenhuma logica muda por causa disso: as partes sao concatenadas byte-a-byte na
// mesma ordem do arquivo original e executadas como se fossem um unico arquivo,
// no mesmo diretorio do projeto (entao __dirname, require() relativo, etc. dentro
// do codigo continuam funcionando exatamente como antes).
const fs = require("fs");
const path = require("path");

const PARTES = [
  "core-part1.js",
  "core-part2.js",
  "core-part3.js",
  "core-part4.js",
  "core-part5.js",
  "core-part6.js",
];

const codigoCompleto = PARTES.map((nome) =>
  fs.readFileSync(path.join(__dirname, nome), "utf8")
).join("");

const arquivoGerado = path.join(__dirname, "_core-combined.generated.js");
fs.writeFileSync(arquivoGerado, codigoCompleto);

require(arquivoGerado);
