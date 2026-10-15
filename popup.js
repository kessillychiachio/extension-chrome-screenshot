document.getElementById("capturar").addEventListener("click", () => {
  chrome.runtime.sendMessage({ acao: "capturar" });
  window.close();
});
