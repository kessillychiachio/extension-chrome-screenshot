chrome.runtime.onMessage.addListener((msg) => {
  if (msg.acao === "capturar") capturarPaginaInteira(msg.formato);
});

async function capturarPaginaInteira(formato) {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  const alvo = { tabId: aba.id };

  await chrome.debugger.attach(alvo, "1.3");

  try {
    const metricas = await chrome.debugger.sendCommand(
      alvo,
      "Page.getLayoutMetrics",
    );
    const tamanho = metricas.cssContentSize || metricas.contentSize;
    const dataHora = new Date().toISOString().replace(/[:.]/g, "-");

    let url, nome;

    if (formato === "pdf") {
      // Usa o visual de tela, não o de impressão
      await chrome.debugger.sendCommand(alvo, "Emulation.setEmulatedMedia", {
        media: "screen",
      });

      // O tamanho do papel é em polegadas: 96 pixels CSS = 1 polegada
      const { data } = await chrome.debugger.sendCommand(
        alvo,
        "Page.printToPDF",
        {
          printBackground: true,
          paperWidth: tamanho.width / 96,
          paperHeight: tamanho.height / 96,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        },
      );

      url = "data:application/pdf;base64," + data;
      nome = `captura-${dataHora}.pdf`;
    } else {
      const { data } = await chrome.debugger.sendCommand(
        alvo,
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: tamanho.width,
            height: tamanho.height,
            scale: 1,
          },
        },
      );

      url = "data:image/png;base64," + data;
      nome = `captura-${dataHora}.png`;
    }

    await chrome.downloads.download({ url, filename: nome });
  } finally {
    await chrome.debugger.detach(alvo);
  }
}
