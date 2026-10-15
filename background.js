chrome.runtime.onMessage.addListener((msg) => {
  if (msg.acao === "capturar") capturarPaginaInteira();
});

async function capturarPaginaInteira() {
  // 1. Descobre qual aba está aberta
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  const alvo = { tabId: aba.id };

  // 2. "Conecta" o debugger na aba
  await chrome.debugger.attach(alvo, "1.3");

  try {
    // 3. Pergunta o tamanho total da página (não só da tela)
    const metricas = await chrome.debugger.sendCommand(
      alvo,
      "Page.getLayoutMetrics",
    );
    const tamanho = metricas.cssContentSize || metricas.contentSize;

    // 4. Captura tudo, inclusive o que está fora da tela
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

    // 5. Salva o arquivo
    const nome = `captura-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    await chrome.downloads.download({
      url: "data:image/png;base64," + data,
      filename: nome,
    });
  } finally {
    // 6. Sempre desconecta, mesmo se der erro
    await chrome.debugger.detach(alvo);
  }
}
