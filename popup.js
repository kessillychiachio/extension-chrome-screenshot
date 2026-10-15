function capturar(formato) {
  chrome.runtime.sendMessage({ acao: "capturar", formato });
  window.close();
}

document.getElementById("png").addEventListener("click", () => capturar("png"));
document.getElementById("pdf").addEventListener("click", () => capturar("pdf"));
