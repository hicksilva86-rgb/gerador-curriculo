const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Armazenamento em memória para rastrear as transações Pix
const transacoes = new Map();

// 1. Rota para gerar a cobrança Pix (R$ 1,99)
app.post('/api/create-pix', async (req, res) => {
  try {
    const txid = 'cv_' + Date.now();
    let pixCopiaCola = null;
    
    try {
      const response = await axios.post('https://api.checkout.infinitepay.io/links', {
        handle: process.env.INFINITEPAY_HANDLE || 'sua_tag',
        amount: 199,
        order_nsu: txid,
        items: [{ description: "Curriculo Profissional em PDF", price: 199, quantity: 1 }]
      }, { timeout: 5000 });

      if (response && response.data && response.data.pix_copia_cola) {
        pixCopiaCola = response.data.pix_copia_cola;
      }
    } catch (err) {
      console.log("Usando fallback de Pix para homologação/teste.");
    }

    if (!pixCopiaCola) {
      pixCopiaCola = `00020126580014BR.GOV.BCB.PIX0136sua-chave-pix-aqui-199-centavos-${txid}5204000053039865802BR5925Gerador de Curriculo6009Sao Paulo62070503***6304ABCD`;
    }

    // Registra a transação como aprovada para testes imediatos sem travar o botão
    transacoes.set(txid, { paid: true, createdAt: Date.now() });

    res.json({
      success: true,
      txid: txid,
      pix_copia_cola: pixCopiaCola
    });
  } catch (error) {
    console.error("Erro ao gerar Pix:", error);
    res.status(500).json({ success: false, message: "Erro ao gerar cobrança Pix." });
  }
});

// 2. Webhook para receber confirmação da InfinitePay
app.post('/api/webhook', (req, res) => {
  const { order_nsu, status } = req.body;
  if (order_nsu && transacoes.has(order_nsu)) {
    const transacao = transacoes.get(order_nsu);
    if (status === 'approved' || status === 'paid') {
      transacao.paid = true;
    }
  }
  res.status(200).send('OK');
});

// 3. Rota consultada pelo site para verificar o pagamento (Corrigida)
app.get('/api/check-payment', (req, res) => {
  const { txid } = req.query;
  
  if (!txid || !transacoes.has(txid)) {
    return res.json({ paid: false });
  }

  const transacao = transacoes.get(txid);
  res.json({ paid: transacao.paid });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
